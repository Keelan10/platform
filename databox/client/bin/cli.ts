#!/usr/bin/env node

import '@ulixee/commons/lib/SourceMapSupport';
import cli from '../cli';

cli().name('@ulixee/databox').parseAsync().catch(console.error)
