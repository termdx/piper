#!/usr/bin/env node
import { PiperApp } from "./app";

const app = new PiperApp();
await app.init();
