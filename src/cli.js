#!/usr/bin/env node

import process from "node:process";
import { run } from "./myopc.js";

run(process.argv.slice(2)).catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`myopc: ${message}`);

  if (process.env.MYOPC_DEBUG === "1" && error instanceof Error && error.stack) {
    console.error(error.stack);
  }

  process.exit(1);
});
