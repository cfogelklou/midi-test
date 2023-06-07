#!/usr/bin/env node

/**
 * This is a sample HTTP server.
 * Replace this with your implementation.
 */

import 'dotenv/config';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { Config } from './config.js';

import * as midi from 'midi';

import pkg from 'midi';
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
      noteIdx = SHARP_NOTE_NAMES.findIndex((value: string, index: number) => {
        return value.toUpperCase() === noteSymbolStr.toUpperCase();
      });
    } else {
      noteIdx = FLAT_NOTE_NAMES.findIndex((value: string, index: number) => {
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
    noteIdx = SHARP_NOTE_NAMES.findIndex((value: string, index: number) => {
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

//const C4: NoteAndOctave = { note: NoteIdx.C, octave: 4 };
const C4Midi = NoteAndOctaveToMidiIdx(ParseNote('C4'));
const CS4Midi = NoteAndOctaveToMidiIdx(ParseNote('C#4'));

const channel = 1; // MIDI channel 1 is channel 0 in the midi library
const noteOnMessage1: midi.MidiMessage = [0x90 + channel, C4Midi, 127]; // note on message (60 = middle C, 127 = velocity)
const noteOffMessage1: midi.MidiMessage = [0x90 + channel, C4Midi, 0]; // note off message
const noteOnMessage2: midi.MidiMessage = [0x90 + channel, CS4Midi, 127]; // note on message (60 = middle C, 127 = velocity)
const noteOffMessage2: midi.MidiMessage = [0x90 + channel, CS4Midi, 0]; // note off message

async function runTest() {
  //const output = new midi.Output()
  const output = new Output();
  const portCount = output.getPortCount();
  console.log('portCount:', portCount);
  console.log('Opening port', 0);
  console.log('Portname:', output.getPortName(0));

  output.openPort(0);

  //console.log('Ports:', JSON.stringify(portNames, null, 2));
  // const noteOnMessage: midi.MidiMessage = [0x90, 60, 127]; // note on message (60 = middle C)
  // const noteOffMessage: midi.MidiMessage = [0x80, 60, 0]; // note off message

  output.openVirtualPort('MIDI Keyboard');

  while (true) {
    console.log('sending note on 1');
    output.send(noteOnMessage1);
    await wait(2000);
    output.send(noteOffMessage1);
    console.log('sending note off 1');
    await wait(2000);

    console.log('sending note on 2');
    output.send(noteOnMessage2);
    await wait(2000);
    output.send(noteOffMessage2);
    console.log('sending note off 2');
    await wait(2000);
  }

  output.closePort();
}

runTest();

/*
const nodePath = resolve(process.argv[1])
const modulePath = resolve(fileURLToPath(import.meta.url))
const isCLI = nodePath === modulePath

export default function main(port: number = Config.port) {
  const requestListener = (request: IncomingMessage, response: ServerResponse) => {
    response.setHeader('content-type', 'text/plain;charset=utf8')
    response.writeHead(200, 'OK')
    response.end('Olá, Hola, Hello!')
  }

  const server = createServer(requestListener)

  if (isCLI) {
    server.listen(port)
    // eslint-disable-next-line no-console
    console.log(`Listening on port: ${port}`)
  }

  return server
}

if (isCLI) {
  main()
}
*/
