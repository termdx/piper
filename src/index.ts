#!/usr/bin/env node
import { program } from "commander";
import pkg from "../package.json" with { type: "json" };
import { PiperApp } from "./app";

program.version(pkg.version, "-v, --version", "Display version number");
program.option("-w, --workspace <name>", "Open with a specific workspace");
program.parse();

const options = program.opts<{ workspace?: string }>();
const app = new PiperApp();
await app.init(options.workspace);
