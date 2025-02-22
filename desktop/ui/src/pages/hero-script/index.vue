<template>
  <div class="flex h-screen flex-row divide-x divide-slate-200 pt-6">
    <div class="controls fixed top-0 left-0 right-0 bg-slate-100 h-6">
      <span class="inline-block p-1 mx-3">Playback script</span>
      <PlayIcon
        v-if="playback === 'manual'"
        class="inline-block h-4 text-slate-800 hover:text-slate-1000"
        @click.prevent="playScript"
      />
      <PauseIcon
        v-else
        class="inline-block h-4 text-slate-800 hover:text-slate-1000"
        @click.prevent="pauseScript"
      />
    </div>
    <div ref="scriptRef" class="basis-4/6 overflow-auto">
      <h5>{{ activeFilename }}</h5>
      <div
        v-for="(line, i) in activeFileLines"
        :key="i"
        :ref="
          el => {
            lineElemsByIdx[i + 1] = el;
          }
        "
        class="line"
        :class="getClassesForLineIndex(i)"
        @click="clickLine(i + 1, activeFilename)"
      >
        <span class="line-number">{{ i + 1 }}.</span>
        <div class="inline-block h-4 w-4">
          <ExclamationTriangleIcon v-if="lineHasError(i)" class="my-1 box-border text-yellow-800" />
        </div>
        <pre class="code">{{ line }}</pre>

        <select
          v-model="focusedCommandId"
          class="call-marker"
          @change="changedFocusedCommand()"
          @click.stop.prevent="onSelectClick($event)"
        >
          <option v-for="call of getCallsForLine(i + 1)" :value="call.commandId">
            {{ call.callInfo }}
          </option>
        </select>
      </div>
    </div>
    <div class="basis-2/6 overflow-auto p-3">
      <h5 class="text-base font-bold">
        Raw Command
      </h5>
      <ul v-if="focusedCommand" class="list-inside list-decimal p-2">
        {{
          focusedCommand.label
        }}
      </ul>
      <h5 class="mt-2 text-base font-bold">
        Result
      </h5>
      <hr>
      <div v-if="focusedCommand" class="p-2">
        <img
          v-if="focusedCommand.resultType === 'image'"
          :src="focusedCommand.result"
          class="object-contain"
        >
        <div v-else class="whitespace-pre">
          {{ focusedCommand.result }}
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import * as Vue from 'vue';
import json5 from 'json5';
import ICommandUpdatedEvent from '@ulixee/desktop-interfaces/events/ICommandUpdatedEvent';
import ICommandFocusedEvent from '@ulixee/desktop-interfaces/events/ICommandFocusedEvent';
import ISourceCodeUpdatedEvent from '@ulixee/desktop-interfaces/events/ISourceCodeUpdatedEvent';
import ISessionAppModeEvent from '@ulixee/desktop-interfaces/events/ISessionAppModeEvent';
import ISessionTimetravelEvent from '@ulixee/desktop-interfaces/events/ISessionTimetravelEvent';
import ICommandWithResult from '@ulixee/hero-core/interfaces/ICommandWithResult';
import { ExclamationTriangleIcon, PauseIcon, PlayIcon } from '@heroicons/vue/24/outline';
import Client from '../../api/Client';

export default Vue.defineComponent({
  name: 'HeroScriptPanel',
  components: { ExclamationTriangleIcon, PlayIcon, PauseIcon },
  setup() {
    return {
      commandIdsByLineKey: {} as { [filename_line: string]: Set<number> },
      lineElemsByIdx: Vue.reactive<{ [index: number]: HTMLElement }>({}),
      focusedPositions: Vue.reactive<{ line: number; filename: string }[]>([]),
      focusedCommandId: Vue.ref<number>(null),
      hasTrueFocus: Vue.ref<boolean>(false),
      scriptRef: Vue.ref<HTMLDivElement>(),
      scriptsByFilename: Vue.reactive<Record<string, ISourceCodeUpdatedEvent['lines']>>({}),
      commandsById: Vue.reactive<{ [commandId: number]: ICommandUpdatedEvent }>({}),
      scrollOnTimeout: -1,
      mode: Vue.ref<ISessionAppModeEvent['mode']>('Live'),
      playback: Vue.ref<ISessionTimetravelEvent['playback']>('manual'),
    };
  },
  watch: {
    'focusedPositions.0.line': function (value) {
      const firstLine = value;
      if (!firstLine) return;
      clearTimeout(this.scrollOnTimeout);
      this.scrollOnTimeout = setTimeout(() => {
        const $el = this.lineElemsByIdx[firstLine];
        if ($el) $el.scrollIntoView({ block: 'center' });
      }) as any;
    },
  },
  computed: {
    activeFileLines(): string[] {
      const filename = this.activeFilename;
      if (!filename) return [];
      return this.scriptsByFilename[filename] ?? [];
    },
    activeFilename(): string {
      return this.focusedPositions?.length ? this.focusedPositions[0].filename : null;
    },
    focusedCommand(): ICommandWithResult {
      return this.commandsById[this.focusedCommandId]?.command;
    },
  },
  methods: {
    playScript(): void {
      this.playback = 'automatic';
      Client.send('Session.timetravel', {
        playback: 'automatic',
      }).catch(err => alert(err.message));
    },

    pauseScript(): void {
      this.playback = 'manual';
      Client.send('Session.timetravel', {
        playback: 'manual',
      }).catch(err => alert(err.message));
    },

    formatJson(text: string | any): string {
      let json = text;
      if (typeof text === 'string') json = JSON.parse(text);
      return json5.stringify(json, null, 2);
    },
    getCallsForLine(line: number): { commandId: number; callInfo: string; active: boolean }[] {
      const filename = this.activeFilename;
      if (!filename) return [];
      const commands = this.getCommandsAtPosition(line, filename);
      if (!commands?.length) return [];
      return commands.map((x, i) => {
        return {
          commandId: x.command.id,
          callInfo: `${i + 1} of ${commands.length}`,
          active: this.focusedCommandId === x.command.id,
        };
      });
    },
    onSelectClick(e): void {
      e.stopPropagation();
    },
    changedFocusedCommand(): void {
      Client.send('Session.timetravel', {
        commandId: this.focusedCommandId,
      }).catch(err => alert(err.message));
    },
    clickLine(line: number, filename: string): Promise<void> {
      const commandIds: Set<number> = this.commandIdsByLineKey[`${filename}_${line}`];
      if (!commandIds?.size) return;
      Client.send('Session.timetravel', {
        commandId: [...commandIds][0],
      }).catch(err => alert(err.message));
    },
    getCommandsAtPosition(line: number, filename: string): ICommandUpdatedEvent[] {
      if (!filename || line === undefined || line === null) return [];
      const commandIds: Set<number> = this.commandIdsByLineKey[`${filename}_${line}`];
      if (commandIds) {
        return [...commandIds].map(id => this.commandsById[id]).filter(Boolean);
      }
      return [];
    },
    lineHasError(index: number): boolean {
      const commandsAtLine = this.getCommandsAtPosition(index + 1, this.activeFilename);
      return commandsAtLine.some(x => x.command.resultType?.includes('Error'));
    },
    getClassesForLineIndex(index: number) {
      const filename = this.activeFilename;
      const active =
        this.focusedPositions?.some(x => x.line === index + 1 && x.filename === filename) ?? false;

      const commandsAtLine = this.getCommandsAtPosition(index + 1, this.activeFilename);
      return {
        active,
        error: this.lineHasError(index),
        'multi-call': commandsAtLine.length > 1,
        command: commandsAtLine.length > 0,
      };
    },
    onCommandUpdated(message: ICommandUpdatedEvent) {
      this.commandsById[message.command.id] = message;
      for (const position of message.originalSourcePosition ?? []) {
        const key = `${position.filename}_${position.line}`;
        this.commandIdsByLineKey[key] ??= new Set();
        this.commandIdsByLineKey[key].add(message.command.id);
      }
      if (!this.hasTrueFocus && message.originalSourcePosition?.length) {
        this.setFocusedPositions(message.originalSourcePosition);
        this.focusedCommandId = message.command.id;
      }
    },
    onCommandFocused(message: ICommandFocusedEvent) {
      this.focusedCommandId = message.commandId;
      this.hasTrueFocus = true;
      const position = this.commandsById[message.commandId]?.originalSourcePosition;
      if (!position?.length) return;
      this.setFocusedPositions(position);
    },
    onSourceCodeUpdated(message: ISourceCodeUpdatedEvent) {
      this.scriptsByFilename[message.filename] = message.lines;
      if (!this.focusedPositions.length) {
        this.focusedPositions.push({ filename: message.filename, line: 1 });
      }
    },

    onScriptStateResponse(message: {
      commandsById: Record<number, ICommandUpdatedEvent>;
      sourceFileLines: Record<string, string[]>;
      focusedCommandId: number;
    }) {
      if (!message) return;
      for (const ev of Object.values(message.commandsById)) {
        this.onCommandUpdated(ev);
      }
      for (const [filename, lines] of Object.entries(message.sourceFileLines)) {
        this.onSourceCodeUpdated({ filename, lines });
      }
      if (message.focusedCommandId) {
        this.onCommandFocused({ commandId: message.focusedCommandId });
      }
    },

    onModeChange(event: ISessionAppModeEvent): void {
      if (event.mode === 'Timetravel' || event.mode === 'Live') {
        this.mode = event.mode;
      }
    },
    // private functions

    setFocusedPositions(positions: ICommandUpdatedEvent['originalSourcePosition']) {
      positions ??= [];
      this.focusedPositions.length = positions.length;
      Object.assign(this.focusedPositions, positions);
    },
  },

  mounted() {
    Client.send('Session.getScriptState', {})
      .then(this.onScriptStateResponse)
      .catch(err => alert(String(err)));
    Client.on('Session.appMode', this.onModeChange);

    Client.on('SourceCode.updated', this.onSourceCodeUpdated);
    Client.on('Command.updated', this.onCommandUpdated);
    Client.on('Command.focused', this.onCommandFocused);
  },

  beforeUnmount() {
    Client.off('SourceCode.updated', this.onSourceCodeUpdated);
    Client.off('Command.updated', this.onCommandUpdated);
    Client.off('Command.focused', this.onCommandFocused);
  },
});
</script>

<style lang="scss">
:root {
  --toolbarBackgroundColor: #f5faff;
  --buttonActiveBackgroundColor: rgba(176, 173, 173, 0.4);
  --buttonHoverBackgroundColor: rgba(255, 255, 255, 0.08);
}

body,
#app {
  height: 100vh;
  margin: 0;
  border-top: 0 none;
  width: 100%;
}
h5 {
  margin: 10px;
}
.controls {
  box-shadow: 0 0 1px rgba(0, 0, 0, 0.12), 0 1px 1px rgba(0, 0, 0, 0.16);
  border-bottom: 1px solid rgba(0, 0, 0, 0.2);
}
.line {
  display: flex;
  flex: 1;
  flex-direction: row;
  justify-content: end;
  align-items: baseline;
  line-height: 16px;
  margin: 0;
  padding: 0;
  pointer-events: none;
  color: #999999;

  .call-marker {
    display: none;
  }

  &.command {
    color: black;
    pointer-events: initial;
    &.multi-call {
      .call-marker {
        display: none;
        float: right;
        font-size: 11px;
        width: 60px;
      }
      &:hover .call-marker {
        display: block;
      }
      &.active .call-marker {
        display: block;
      }
    }
    &:hover {
      outline: #83898d dashed 1px;
      cursor: pointer;
    }
    .line-number {
      color: black;
    }
  }
  &.active {
    outline: #3498db dashed 2px;
    .line-number {
      font-weight: bold;
      color: black;
    }
    &:hover {
      outline: #3498db dashed 2px;
      cursor: auto;
    }
  }
  .line-number {
    display: flex;
    flex-grow: 0;
    flex-basis: 30px;
    line-height: 16px;
    font-size: 12px;
    color: #595959;
  }
  pre {
    flex: 1;
    margin: 1px 0;
    font-family: system-ui;
    font-size: 13px;
    line-height: 13px;
  }
}
</style>
