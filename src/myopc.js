import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import process from "node:process";
import { fileURLToPath } from "node:url";

const MANIFEST_FILENAME = ".myopc-manifest.json";

const ASSETS = [
  {
    key: "skill:beads-plan",
    relativePath: "skills/beads-plan/SKILL.md",
    sourcePath: fileURLToPath(new URL("../assets/opencode/skills/beads-plan/SKILL.md", import.meta.url)),
  },
  {
    key: "skill:beads-work",
    relativePath: "skills/beads-work/SKILL.md",
    sourcePath: fileURLToPath(new URL("../assets/opencode/skills/beads-work/SKILL.md", import.meta.url)),
  },
  {
    key: "skill:beads-status",
    relativePath: "skills/beads-status/SKILL.md",
    sourcePath: fileURLToPath(new URL("../assets/opencode/skills/beads-status/SKILL.md", import.meta.url)),
  },
  {
    key: "command:beads-plan",
    relativePath: "commands/beads-plan.md",
    sourcePath: fileURLToPath(new URL("../assets/opencode/commands/beads-plan.md", import.meta.url)),
  },
  {
    key: "command:beads-work",
    relativePath: "commands/beads-work.md",
    sourcePath: fileURLToPath(new URL("../assets/opencode/commands/beads-work.md", import.meta.url)),
  },
  {
    key: "command:beads-status",
    relativePath: "commands/beads-status.md",
    sourcePath: fileURLToPath(new URL("../assets/opencode/commands/beads-status.md", import.meta.url)),
  },
];

export async function run(argv) {
  const packageInfo = await readPackageInfo();
  const parsed = parseArgs(argv);

  if (parsed.version) {
    console.log(packageInfo.version);
    return;
  }

  if (parsed.help || parsed.command === "help") {
    console.log(renderHelp(packageInfo));
    return;
  }

  if (parsed.command === "doctor") {
    const result = await runDoctor(parsed.options, packageInfo);
    if (!result.ok) {
      process.exitCode = 1;
    }
    return;
  }

  if (parsed.command === "uninstall") {
    const result = await runUninstall(parsed.options, packageInfo);
    if (!result.ok) {
      process.exitCode = 1;
    }
    return;
  }

  const result = await runInstall(parsed.options, packageInfo);
  if (!result.ok) {
    process.exitCode = 1;
  }
}

function parseArgs(argv) {
  const options = {
    yes: false,
    force: false,
    configDir: null,
  };

  let command = "install";
  let commandSet = false;
  let help = false;
  let version = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!commandSet && !arg.startsWith("-") && isKnownCommand(arg)) {
      command = arg;
      commandSet = true;
      continue;
    }

    if (arg === "-h" || arg === "--help") {
      help = true;
      continue;
    }

    if (arg === "-V" || arg === "--version") {
      version = true;
      continue;
    }

    if (arg === "-y" || arg === "--yes") {
      options.yes = true;
      continue;
    }

    if (arg === "-f" || arg === "--force") {
      options.force = true;
      continue;
    }

    if (arg === "--config-dir") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --config-dir");
      }
      options.configDir = path.resolve(value);
      index += 1;
      continue;
    }

    if (arg.startsWith("--config-dir=")) {
      options.configDir = path.resolve(arg.slice("--config-dir=".length));
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    command,
    help,
    version,
    options,
  };
}

function isKnownCommand(value) {
  return value === "install" || value === "doctor" || value === "uninstall" || value === "help";
}

function renderHelp(packageInfo) {
  return [
    `${packageInfo.name} v${packageInfo.version}`,
    "",
    "Usage:",
    "  myopc [install] [--yes] [--force] [--config-dir <path>]",
    "  myopc doctor [--config-dir <path>]",
    "  myopc uninstall [--yes] [--force] [--config-dir <path>]",
    "  myopc --help",
    "  myopc --version",
    "",
    "Commands:",
    "  install    Install OpenCode skills and commands (default)",
    "  doctor     Check dependencies and installed asset health",
    "  uninstall  Remove files previously managed by myopc",
    "",
    "Options:",
    "  -y, --yes              Non-interactive mode",
    "  -f, --force            Overwrite or remove conflicting files after backup",
    "      --config-dir PATH  Install into a custom OpenCode config directory",
  ].join("\n");
}

async function runInstall(options, packageInfo) {
  const context = await buildContext(options, packageInfo);
  const manifest = await readManifest(context.manifestPath);
  const nextEntries = new Map((manifest.files ?? []).map((entry) => [entry.relativePath, entry]));
  const results = [];

  for (const asset of context.assets) {
    const previousEntry = nextEntries.get(asset.relativePath) ?? null;
    const result = await installAsset(asset, previousEntry, context);
    results.push(result);

    if (result.nextEntry) {
      nextEntries.set(asset.relativePath, result.nextEntry);
    }
  }

  if (nextEntries.size > 0) {
    await writeManifest(context.manifestPath, {
      schemaVersion: 1,
      packageName: packageInfo.name,
      packageVersion: packageInfo.version,
      configDir: context.configDir,
      updatedAt: new Date().toISOString(),
      files: Array.from(nextEntries.values()).sort((left, right) => left.relativePath.localeCompare(right.relativePath)),
    });
  } else {
    await removeFileIfExists(context.manifestPath);
  }

  const summary = summarizeInstallResults(results);
  printInstallSummary(summary, context, packageInfo);
  return { ok: summary.skipped === 0 };
}

async function installAsset(asset, previousEntry, context) {
  const desiredContent = await fs.readFile(asset.sourcePath, "utf8");
  const desiredHash = hashContent(desiredContent);
  const destinationPath = resolveDestinationPath(context.configDir, asset.relativePath);
  const currentContent = await readFileIfExists(destinationPath);

  if (currentContent === null) {
    await writeTextFile(destinationPath, desiredContent);
    return {
      status: "created",
      asset,
      destinationPath,
      nextEntry: createManifestEntry(asset, desiredHash, previousEntry?.backupPath ?? null),
    };
  }

  const currentHash = hashContent(currentContent);
  if (currentHash === desiredHash) {
    return {
      status: previousEntry ? "unchanged" : "present",
      asset,
      destinationPath,
      nextEntry: previousEntry ? createManifestEntry(asset, desiredHash, previousEntry.backupPath ?? null) : null,
    };
  }

  if (previousEntry && currentHash === previousEntry.installedHash) {
    await writeTextFile(destinationPath, desiredContent);
    return {
      status: "updated",
      asset,
      destinationPath,
      nextEntry: createManifestEntry(asset, desiredHash, previousEntry.backupPath ?? null),
    };
  }

  if (previousEntry) {
    const overwriteManaged = await shouldOverwrite(
      `Managed file was edited locally: ${destinationPath}. Overwrite and keep a safety backup?`,
      context,
    );

    if (!overwriteManaged) {
      return {
        status: "skipped",
        asset,
        destinationPath,
        reason: "locally modified managed file",
        nextEntry: previousEntry,
      };
    }

    await createBackup(destinationPath, ".myopc.local");
    await writeTextFile(destinationPath, desiredContent);
    return {
      status: "updated",
      asset,
      destinationPath,
      nextEntry: createManifestEntry(asset, desiredHash, previousEntry.backupPath ?? null),
    };
  }

  const overwriteUnmanaged = await shouldOverwrite(
    `Unmanaged file already exists: ${destinationPath}. Back it up and overwrite?`,
    context,
  );

  if (!overwriteUnmanaged) {
    return {
      status: "skipped",
      asset,
      destinationPath,
      reason: "conflicts with existing unmanaged file",
      nextEntry: null,
    };
  }

  const backupPath = await createBackup(destinationPath, ".myopc.bak");
  await writeTextFile(destinationPath, desiredContent);
  return {
    status: "overwritten",
    asset,
    destinationPath,
    backupPath,
    nextEntry: createManifestEntry(asset, desiredHash, backupPath),
  };
}

function createManifestEntry(asset, installedHash, backupPath) {
  return {
    relativePath: asset.relativePath,
    assetKey: asset.key,
    installedHash,
    backupPath,
  };
}

function summarizeInstallResults(results) {
  const summary = {
    created: 0,
    updated: 0,
    overwritten: 0,
    unchanged: 0,
    present: 0,
    skipped: 0,
    warnings: [],
  };

  for (const result of results) {
    summary[result.status] += 1;
    if (result.status === "skipped") {
      summary.warnings.push(`${result.asset.relativePath}: ${result.reason}`);
    }
  }

  return summary;
}

function printInstallSummary(summary, context, packageInfo) {
  console.log(`Installed ${packageInfo.name} assets into ${context.configDir}`);
  console.log(`Created: ${summary.created}`);
  console.log(`Updated: ${summary.updated}`);
  console.log(`Overwritten after backup: ${summary.overwritten}`);
  console.log(`Already up to date: ${summary.unchanged}`);
  console.log(`Already present (unmanaged): ${summary.present}`);
  console.log(`Skipped: ${summary.skipped}`);

  const brStatus = checkCommand("br", ["version"]);
  const bvStatus = checkCommand("bv", ["--help"]);

  if (!brStatus.ok) {
    console.log("");
    console.log("Warning: `br` was not found on PATH. `/beads-plan` and `/beads-work` need it.");
  }

  if (!bvStatus.ok) {
    console.log("");
    console.log("Note: `bv` was not found on PATH. This is optional.");
  }

  if (summary.warnings.length > 0) {
    console.log("");
    console.log("Conflicts:");
    for (const warning of summary.warnings) {
      console.log(`- ${warning}`);
    }
    console.log("Re-run with `--force` to overwrite conflicting files after backup.");
  }

  console.log("");
  console.log("Next steps:");
  console.log("1. Open OpenCode.");
  console.log("2. Run `/beads-status` to verify the commands are visible.");
  console.log("3. Run `/beads-plan <your feature>` to create beads from a request.");
}

async function runDoctor(options, packageInfo) {
  const context = await buildContext(options, packageInfo);
  const manifest = await readManifest(context.manifestPath);
  const brStatus = checkCommand("br", ["version"]);
  const bvStatus = checkCommand("bv", ["--help"]);
  const configDirExists = await exists(context.configDir);
  const assetStatuses = [];

  for (const asset of context.assets) {
    const desiredContent = await fs.readFile(asset.sourcePath, "utf8");
    const desiredHash = hashContent(desiredContent);
    const destinationPath = resolveDestinationPath(context.configDir, asset.relativePath);
    const currentContent = await readFileIfExists(destinationPath);
    const manifestEntry = (manifest.files ?? []).find((entry) => entry.relativePath === asset.relativePath) ?? null;

    if (currentContent === null) {
      assetStatuses.push({ asset, status: "missing" });
      continue;
    }

    const currentHash = hashContent(currentContent);
    if (currentHash === desiredHash) {
      assetStatuses.push({ asset, status: manifestEntry ? "ok" : "present" });
      continue;
    }

    if (manifestEntry) {
      assetStatuses.push({ asset, status: "modified" });
      continue;
    }

    assetStatuses.push({ asset, status: "conflict" });
  }

  console.log(`${packageInfo.name} doctor`);
  console.log("");
  console.log(`Config dir: ${context.configDir}`);
  console.log(`Manifest: ${manifest.files ? "found" : "not found"}`);
  console.log(`Config dir exists: ${configDirExists ? "yes" : "no"}`);
  console.log("");
  console.log(`Required tool - br: ${brStatus.ok ? "ok" : "missing"}`);
  console.log(`Optional tool - bv: ${bvStatus.ok ? "ok" : "missing"}`);
  console.log("");
  console.log("Assets:");
  for (const assetStatus of assetStatuses) {
    console.log(`- ${assetStatus.asset.relativePath}: ${assetStatus.status}`);
  }

  const missingAssets = assetStatuses.filter((item) => item.status === "missing").length;
  const changedAssets = assetStatuses.filter((item) => item.status === "modified" || item.status === "conflict").length;
  const ok = brStatus.ok && missingAssets === 0 && changedAssets === 0;

  console.log("");
  console.log(`Overall status: ${ok ? "healthy" : "needs attention"}`);
  return { ok };
}

async function runUninstall(options, packageInfo) {
  const context = await buildContext(options, packageInfo);
  const manifest = await readManifest(context.manifestPath);

  if (!manifest.files || manifest.files.length === 0) {
    console.log(`No managed ${packageInfo.name} files found in ${context.configDir}`);
    return { ok: true };
  }

  if (!options.yes) {
    if (!context.interactive) {
      throw new Error("Uninstall requires --yes in non-interactive mode.");
    }

    const confirmed = await promptYesNo(
      `Remove ${manifest.files.length} managed files from ${context.configDir}?`,
      false,
    );
    if (!confirmed) {
      console.log("Uninstall cancelled.");
      return { ok: true };
    }
  }

  const remainingEntries = [];
  const summary = {
    removed: 0,
    restored: 0,
    skipped: 0,
  };

  for (const entry of manifest.files) {
    const destinationPath = resolveDestinationPath(context.configDir, entry.relativePath);
    const currentContent = await readFileIfExists(destinationPath);

    if (currentContent !== null && hashContent(currentContent) !== entry.installedHash && !options.force) {
      console.log(`Skipped modified file: ${destinationPath}`);
      remainingEntries.push(entry);
      summary.skipped += 1;
      continue;
    }

    if (currentContent !== null) {
      await fs.unlink(destinationPath);
      await pruneEmptyParents(path.dirname(destinationPath), context.configDir);
    }

    if (entry.backupPath && (await exists(entry.backupPath))) {
      await ensureParentDirectory(destinationPath);
      await fs.rename(entry.backupPath, destinationPath);
      summary.restored += 1;
      continue;
    }

    summary.removed += 1;
  }

  if (remainingEntries.length > 0) {
    await writeManifest(context.manifestPath, {
      schemaVersion: 1,
      packageName: packageInfo.name,
      packageVersion: packageInfo.version,
      configDir: context.configDir,
      updatedAt: new Date().toISOString(),
      files: remainingEntries,
    });
  } else {
    await removeFileIfExists(context.manifestPath);
  }

  console.log(`Removed: ${summary.removed}`);
  console.log(`Restored backups: ${summary.restored}`);
  console.log(`Skipped: ${summary.skipped}`);
  return { ok: summary.skipped === 0 };
}

async function buildContext(options, packageInfo) {
  const configDir = options.configDir ?? path.join(os.homedir(), ".config", "opencode");
  return {
    assets: ASSETS,
    configDir,
    force: options.force,
    interactive: !options.yes && process.stdin.isTTY && process.stdout.isTTY,
    manifestPath: path.join(configDir, MANIFEST_FILENAME),
    packageInfo,
  };
}

async function readPackageInfo() {
  const packagePath = fileURLToPath(new URL("../package.json", import.meta.url));
  const raw = await fs.readFile(packagePath, "utf8");
  return JSON.parse(raw);
}

async function readManifest(manifestPath) {
  const raw = await readFileIfExists(manifestPath);
  if (raw === null) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Manifest is not valid JSON: ${manifestPath}`);
  }
}

async function writeManifest(manifestPath, manifest) {
  await writeTextFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function resolveDestinationPath(configDir, relativePath) {
  return path.join(configDir, ...relativePath.split("/"));
}

async function shouldOverwrite(message, context) {
  if (context.force) {
    return true;
  }

  if (!context.interactive) {
    return false;
  }

  return promptYesNo(message, false);
}

async function promptYesNo(message, defaultValue) {
  const suffix = defaultValue ? " [Y/n] " : " [y/N] ";
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = (await readline.question(`${message}${suffix}`)).trim().toLowerCase();
    if (answer.length === 0) {
      return defaultValue;
    }
    return answer === "y" || answer === "yes";
  } finally {
    readline.close();
  }
}

async function writeTextFile(filePath, content) {
  await ensureParentDirectory(filePath);
  await fs.writeFile(filePath, content, "utf8");
}

async function ensureParentDirectory(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function createBackup(filePath, label) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `${filePath}${label}-${timestamp}`;
  await fs.copyFile(filePath, backupPath);
  return backupPath;
}

function hashContent(content) {
  return createHash("sha256").update(content).digest("hex");
}

async function readFileIfExists(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function removeFileIfExists(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
}

async function pruneEmptyParents(startDir, stopDir) {
  let current = startDir;
  const normalizedStop = path.resolve(stopDir);

  while (path.resolve(current).startsWith(normalizedStop) && path.resolve(current) !== normalizedStop) {
    const entries = await fs.readdir(current);
    if (entries.length > 0) {
      return;
    }
    await fs.rmdir(current);
    current = path.dirname(current);
  }
}

function checkCommand(command, args) {
  const result = spawnSync(command, args, {
    stdio: "ignore",
  });

  if (result.error) {
    return { ok: false, error: result.error.message };
  }

  return { ok: result.status === 0 };
}
