#!/usr/bin/env node

/**
 * This is a sample HTTP server.
 * Replace this with your implementation.
 */

import 'dotenv/config';
import { on } from 'events';

import * as midi from 'midi';
import { spawn } from 'child_process';

import pkg from 'midi';
import { off } from 'process';
import * as fs from 'fs';
const { Output } = pkg;

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const ONE_OVER_LN_2 = 1.0 / Math.log(2.0);

// Juce and other MIDI software assigns middle-C to octave 3.
export const MIDDLE_C_DEFAULT_OCTAVE = 4;

// 12 is C0
export const MIDI_IDX_C0 = 12;
export const MIDI_IDX_C4 = 60;
export const MIDI_IDX_A4 = 69;
export const MIDI_IDX_CS9 = 121;
// NoteAndOctave scale note and octave of 0,0 ==> A4 440Hz.
// A4 is at midi index 69.
export const A4_MIDI_IDX_OFFSET = 69 - 12;

// A4 Ref --> C0 Ref
export const REF_FREQ_CHROMATIC_CONVERT_TO_C0 = Math.pow(
  2,
  -A4_MIDI_IDX_OFFSET / 12.0, // -57 / 12
);

export enum NoteIdx {
  C = 0,
  Cs = 1,
  D = 2,
  Ds = 3,
  E = 4,
  F = 5,
  Fs = 6,
  G = 7,
  Gs = 8,
  A = 9,
  As = 10,
  B = 11,
}

export const SHARP_NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const FLAT_NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
export const FlatNotesStr = ['C#', 'D#', 'F#', 'G#', 'A#'];
export const SharpNotesStr = ['Db', 'Eb', 'Gb', 'Ab', 'Bb'];
export const FlatSharpIdxs = [1, 3, 6, 8, 10];
export const NonFlatNotesStr = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
export const NonFlatNotesIdxs = [0, 2, 4, 5, 7, 9, 11];

// ----------------------------------------------------------------------------
// If you want to get the name of a note, but your indexes start at A == 0, use this function.
export function getAOffsetName(idx: number): string {
  const aOffset = (idx + NoteIdx.A) % 12;
  return SHARP_NOTE_NAMES[aOffset];
}

// ----------------------------------------------------------------------------
export function getCOffsetName(idx: number): string {
  const cOffset = (idx + NoteIdx.C) % 12;
  return SHARP_NOTE_NAMES[cOffset];
}

// ----------------------------------------------------------------------------
// The chromatic functions start from C0 at 16.351Hz.
export type NoteAndOctave = {
  note: number;
  octave: number;
  invalidOctave?: boolean;
};

// ----------------------------------------------------------------------------
export function ParseNote(str: string): NoteAndOctave {
  let noteSymbolStr = str.slice(0, 1);
  const noteSharpFlat = str.slice(1, 2);
  let octaveNum = 0;
  let noteIdx = -1;
  let invalidOctave = false;
  if (noteSharpFlat === '#' || noteSharpFlat === 'b' || noteSharpFlat === 'B') {
    // Is a flat note or sharp note.
    const octaveStr = str.slice(2);
    if (octaveStr.length >= 1) {
      octaveNum = parseInt(octaveStr, 10);
    } else {
      invalidOctave = true;
    }
    noteSymbolStr = str.slice(0, 2);
    if (noteSharpFlat === '#') {
      noteIdx = SHARP_NOTE_NAMES.findIndex((value: string, _i: number) => {
        return value.toUpperCase() === noteSymbolStr.toUpperCase();
      });
    } else {
      noteIdx = FLAT_NOTE_NAMES.findIndex((value: string, _i: number) => {
        return value.toUpperCase() === noteSymbolStr.toUpperCase();
      });
    }
  } else {
    const octaveStr = str.slice(1);
    if (octaveStr.length >= 1) {
      octaveNum = parseInt(octaveStr, 10);
    } else {
      invalidOctave = true;
    }
    noteIdx = SHARP_NOTE_NAMES.findIndex((value: string, _i: number) => {
      return value.toUpperCase() === noteSymbolStr.toUpperCase();
    });
  }
  const c: NoteAndOctave = {
    note: noteIdx,
    octave: octaveNum,
    invalidOctave,
  };
  return c;
}

// ----------------------------------------------------------------------------
export function NoteAndOctaveToMidiIdx(c: NoteAndOctave): number {
  return c.octave * 12 + c.note + MIDI_IDX_C0;
}

class Recorder {
  recorder: any;

  start(name: string) {
    const file = fs.createWriteStream(name, { encoding: 'binary' });

    const sampleRate = 44100;
    // Spawn a child process to run the 'sox' command
    this.recorder = spawn('sox', ['-d', '-r' + sampleRate.toString(), '-t', 'wav', '-']);

    // Pipe the output of 'sox' to the file
    this.recorder.stdout.pipe(file);
  }

  kill() {
    if (this.recorder) {
      this.recorder.kill();
      this.recorder = null;
    }
  }
}

const channel = 1; // MIDI channel 1 is channel 0 in the midi library

async function runTest() {
  //const output = new midi.Output()
  const output = new Output();
  const portCount = output.getPortCount();
  if (portCount > 0) {
    console.log('PortCount:' + portCount);
    console.log('Opening port:' + 0);
    console.log('Portname:' + output.getPortName(0));

    output.openPort(0);
    output.openVirtualPort('MIDI Keyboard');
    const r = new Recorder();

    for (let program = 0; program <= 31; program++) {
      console.log('Program:' + program);
      // Select new midi instrument
      // Need to cast to any because MidiMessage if fixed 3 bytes, but it doesn't work unless the array is 2 bytes.
      const programChangeMessage: any = [0xc0 + channel, program];
      output.send(programChangeMessage);

      let done: boolean = false;
      const noteAndOctave: NoteAndOctave = ParseNote('C-1');

      while (!done) {
        const noteStr = getCOffsetName(noteAndOctave.note);
        r.start('recordings/' + program.toFixed(0) + '_' + noteStr + noteAndOctave.octave.toFixed(0) + '.wav');
        for (let volume = 10; volume <= 120; volume += 10) {
          await playNote(noteAndOctave, volume, 50, 10);
        }
        noteAndOctave.note++;
        if (noteAndOctave.note > 11) {
          noteAndOctave.note = 0;
          noteAndOctave.octave++;
        }

        const midiIdx = NoteAndOctaveToMidiIdx(noteAndOctave);
        if (midiIdx >= MIDI_IDX_CS9) {
          done = true;
        }

        r.kill();
      }
    }

    output.closePort();
  } else {
    console.log('No midi ports to open');
  }

  async function playNote(
    noteAndOctave: NoteAndOctave,
    volume: number = 127,
    onTime: number = 700,
    offTime: number = 500,
  ) {
    // Print the note and octave.
    const noteStr = getCOffsetName(noteAndOctave.note);

    await wait(100);

    console.log(
      'note:' + noteStr + ' octave:' + noteAndOctave.octave + ' midi:' + NoteAndOctaveToMidiIdx(noteAndOctave),
    );

    const note = NoteAndOctaveToMidiIdx(noteAndOctave);

    const noteOnMessage1: midi.MidiMessage = [0x90 + channel, note, volume];
    output.send(noteOnMessage1);
    await wait(onTime);
    const noteOffMessage1: midi.MidiMessage = [0x90 + channel, note, 0];
    output.send(noteOffMessage1);
    await wait(offTime);
  }
}

export default function main() {
  runTest();
}

main();
