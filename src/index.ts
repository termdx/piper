#!/usr/bin/env node
import { program } from "commander";
import pkg from "../package.json" with { type: "json" };
import { PiperApp } from "./app";

program.version(pkg.version, "-v, --version", "Display version number");
program.parse();

const app = new PiperApp();
await app.init();
