#!/usr/bin/env python3
"""
Generate test audio files with known chords for ChordDetective validation.
Pure Python — no numpy/scipy needed.
"""

import wave
import struct
import math
import os

SAMPLE_RATE = 44100
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "test_audio")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# MIDI note to frequency (A4 = 440)
def midi_to_freq(midi):
    return 440.0 * (2 ** ((midi - 69) / 12))

# Note name to MIDI (C4 = 60)
NOTE_TO_MIDI = {
    "C": 48, "C#": 49, "Db": 49, "D": 50, "D#": 51, "Eb": 51,
    "E": 52, "F": 53, "F#": 54, "Gb": 54, "G": 55, "G#": 56,
    "Ab": 56, "A": 57, "A#": 58, "Bb": 58, "B": 59
}

# Chord definitions: name -> [notes]
CHORDS = {
    "C":    ["C", "E", "G"],
    "Cm":   ["C", "Eb", "G"],
    "Cdim": ["C", "Eb", "Gb"],
    "Caug": ["C", "E", "G#"],
    "Csus2":["C", "D", "G"],
    "Csus4":["C", "F", "G"],
    "C7":   ["C", "E", "G", "Bb"],
    "Cm7":  ["C", "Eb", "G", "Bb"],
    "Cmaj7":["C", "E", "G", "B"],
    "Dm":   ["D", "F", "A"],
    "Em":   ["E", "G", "B"],
    "F":    ["F", "A", "C"],
    "G":    ["G", "B", "D"],
    "Am":   ["A", "C", "E"],
    "Bdim": ["B", "D", "F"],
    "D7":   ["D", "F#", "A", "C"],
    "G7":   ["G", "B", "D", "F"],
}

def write_wav(filename, samples, sample_rate=SAMPLE_RATE):
    """Write mono 16-bit PCM WAV file."""
    path = os.path.join(OUTPUT_DIR, filename)
    with wave.open(path, "w") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)  # 16-bit
        wav.setframerate(sample_rate)
        # Convert float [-1,1] to int16
        int_samples = []
        for s in samples:
            clamped = max(-1.0, min(1.0, s))
            int_samples.append(int(clamped * 32767))
        wav.writeframes(struct.pack(f"<{len(int_samples)}h", *int_samples))
    size_mb = os.path.getsize(path) / 1024 / 1024
    print(f"  -> {filename} ({size_mb:.2f} MB, {len(samples)/sample_rate:.1f}s)")
    return path


def sine_wave(freq, duration, sample_rate=SAMPLE_RATE, amplitude=0.3):
    """Generate a sine wave at given frequency."""
    n = int(sample_rate * duration)
    return [amplitude * math.sin(2 * math.pi * freq * i / sample_rate) for i in range(n)]


def adsr_envelope(duration, sample_rate, attack=0.02, decay=0.05, sustain=0.7, release=0.15):
    """Generate ADSR amplitude envelope."""
    n = int(sample_rate * duration)
    env = []
    attack_n = int(sample_rate * attack)
    decay_n = int(sample_rate * decay)
    release_n = int(sample_rate * release)
    sustain_n = n - attack_n - decay_n - release_n
    
    for i in range(attack_n):
        env.append(i / attack_n)
    for i in range(decay_n):
        env.append(1.0 - (1.0 - sustain) * i / decay_n)
    for i in range(sustain_n):
        env.append(sustain)
    for i in range(release_n):
        env.append(sustain * (1.0 - i / release_n))
    
    # Ensure length matches
    while len(env) < n:
        env.append(0)
    return env[:n]


def generate_chord_sound(notes_midi, duration, amplitude=0.3):
    """Generate audio for a chord (sustained)."""
    freqs = [midi_to_freq(m) for m in notes_midi]
    env = adsr_envelope(duration, SAMPLE_RATE, attack=0.03, decay=0.08, sustain=0.6, release=0.2)
    n = len(env)
    samples = [0.0] * n
    
    amp_per_note = amplitude / len(freqs)
    for freq in freqs:
        # Add slight detuning harmonics for realism
        for harmonic, harmonic_amp in [(1, 1.0), (2, 0.35), (3, 0.15)]:
            for i in range(n):
                samples[i] += harmonic_amp * amp_per_note * math.sin(2 * math.pi * freq * harmonic * i / SAMPLE_RATE) * env[i]
    
    return samples


def generate_strum(chord_name, duration=2.0, strums=4):
    """Generate strummed chord audio."""
    notes_midi = [NOTE_TO_MIDI[n] + 12 for n in CHORDS[chord_name]]  # up one octave
    n = int(SAMPLE_RATE * duration)
    samples = [0.0] * n
    strum_interval = duration / strums
    strum_len = int(SAMPLE_RATE * 0.12)  # 120ms strum
    
    for s in range(strums):
        start = int(s * strum_interval * SAMPLE_RATE)
        for j, midi in enumerate(notes_midi):
            offset = j * int(SAMPLE_RATE * 0.015)  # 15ms between strings
            pos = start + offset
            freq = midi_to_freq(midi)
            for i in range(strum_len):
                idx = pos + i
                if idx >= n:
                    break
                env = 1.0 - i / strum_len  # linear decay
                samples[idx] += 0.2 * math.sin(2 * math.pi * freq * idx / SAMPLE_RATE) * env
    
    return samples


# ============================================================
# TEST 1: Individual sustained chords (4 seconds each, 1s gap)
# ============================================================
print("=== Test 1: Individual sustained chords ===")
test1_chords = ["C", "Cm", "G", "Am", "F", "Dm", "Em", "C7", "G7", "Dm", "Cmaj7", "Csus4"]
samples_1 = []
timeline_1 = []  # (start_time, end_time, chord_name)

silence = [0.0] * int(SAMPLE_RATE * 1.5)  # 1.5s silence between chords
for chord in test1_chords:
    notes = [NOTE_TO_MIDI[n] + 12 for n in CHORDS[chord]]
    chord_audio = generate_chord_sound(notes, 4.0)
    start = len(samples_1) / SAMPLE_RATE
    end = (len(samples_1) + len(chord_audio)) / SAMPLE_RATE
    timeline_1.append((start, end, chord))
    samples_1.extend(chord_audio)
    samples_1.extend(silence)

write_wav("01_single_chords.wav", samples_1)
print(f"  Timeline: {[(f'{t[2]} @ {t[0]:.1f}-{t[1]:.1f}s') for t in timeline_1]}")


# ============================================================
# TEST 2: Chord progression (C - Am - F - G - C)
# ============================================================
print("\n=== Test 2: Classic I-vi-IV-V-I progression ===")
progression = ["C", "Am", "F", "G", "C"]
samples_2 = []
timeline_2 = []

for chord in progression:
    notes = [NOTE_TO_MIDI[n] + 12 for n in CHORDS[chord]]
    chord_audio = generate_chord_sound(notes, 3.0, amplitude=0.35)
    start = len(samples_2) / SAMPLE_RATE
    end = (len(samples_2) + len(chord_audio)) / SAMPLE_RATE
    timeline_2.append((start, end, chord))
    samples_2.extend(chord_audio)
    samples_2.extend([0.0] * int(SAMPLE_RATE * 0.3))  # 0.3s transition

write_wav("02_progression_C_Am_F_G.wav", samples_2)
print(f"  Timeline: {[(f'{t[2]} @ {t[0]:.1f}-{t[1]:.1f}s') for t in timeline_2]}")


# ============================================================
# TEST 3: Chord progression with 7th chords (jazzier)
# ============================================================
print("\n=== Test 3: Jazz progression with 7ths ===")
progression_3 = ["Cmaj7", "Dm7", "G7", "Cmaj7", "Cm7", "F", "Bdim", "Em"]
# Map to actual chords defined above
actual_chords = {
    "Cmaj7": "Cmaj7", "Dm7": "Dm7" if "Dm7" in CHORDS else "Dm",  # fallback
    "G7": "G7", "Cm7": "Cm7", "F": "F", "Bdim": "Bdim", "Em": "Em"
}
# Use closest available:
prog3 = ["Cmaj7", "D7", "G7", "Cmaj7", "Cm7", "F", "Bdim", "Em"]
samples_3 = []
timeline_3 = []

for chord in prog3:
    notes = [NOTE_TO_MIDI[n] + 12 for n in CHORDS[chord]]
    chord_audio = generate_chord_sound(notes, 2.5, amplitude=0.35)
    start = len(samples_3) / SAMPLE_RATE
    end = (len(samples_3) + len(chord_audio)) / SAMPLE_RATE
    timeline_3.append((start, end, chord))
    samples_3.extend(chord_audio)
    samples_3.extend([0.0] * int(SAMPLE_RATE * 0.25))

write_wav("03_jazz_progression.wav", samples_3)
print(f"  Timeline: {[(f'{t[2]} @ {t[0]:.1f}-{t[1]:.1f}s') for t in timeline_3]}")


# ============================================================
# TEST 4: Strummed chords (mimics guitar)
# ============================================================
print("\n=== Test 4: Strummed guitar-style chords ===")
strum_prog = ["C", "Am", "F", "G"]
samples_4 = []
timeline_4 = []

for chord in strum_prog:
    strum_audio = generate_strum(chord, duration=3.0, strums=6)
    start = len(samples_4) / SAMPLE_RATE
    end = (len(samples_4) + len(strum_audio)) / SAMPLE_RATE
    timeline_4.append((start, end, chord))
    samples_4.extend(strum_audio)
    samples_4.extend([0.0] * int(SAMPLE_RATE * 0.4))

write_wav("04_strummed_guitar.wav", samples_4)
print(f"  Timeline: {[(f'{t[2]} @ {t[0]:.1f}-{t[1]:.1f}s') for t in timeline_4]}")


# ============================================================
# TEST 5: Sus and dim chords
# ============================================================
print("\n=== Test 5: Suspended & diminished ===")
sus_prog = ["Csus2", "Csus4", "C", "Cdim", "Caug", "Cm"]
samples_5 = []
timeline_5 = []

for chord in sus_prog:
    notes = [NOTE_TO_MIDI[n] + 12 for n in CHORDS[chord]]
    chord_audio = generate_chord_sound(notes, 3.0, amplitude=0.35)
    start = len(samples_5) / SAMPLE_RATE
    end = (len(samples_5) + len(chord_audio)) / SAMPLE_RATE
    timeline_5.append((start, end, chord))
    samples_5.extend(chord_audio)
    samples_5.extend([0.0] * int(SAMPLE_RATE * 0.5))

write_wav("05_sus_dim_aug.wav", samples_5)
print(f"  Timeline: {[(f'{t[2]} @ {t[0]:.1f}-{t[1]:.1f}s') for t in timeline_5]}")


# ============================================================
# TEST 6: Same chord, different voicings/bass notes
# ============================================================
print("\n=== Test 6: C chord with bass variation ===")
samples_6 = []
timeline_6 = []

# C in root position
notes = [NOTE_TO_MIDI["C"] + 12, NOTE_TO_MIDI["E"] + 12, NOTE_TO_MIDI["G"] + 12]
chunk = generate_chord_sound(notes, 3.0, amplitude=0.35)
start = len(samples_6) / SAMPLE_RATE
timeline_6.append((start, start + 3.0, "C (root)"))
samples_6.extend(chunk)
samples_6.extend([0.0] * int(SAMPLE_RATE * 0.3))

# C with bass note emphasized lower octave
bass_note = sine_wave(midi_to_freq(NOTE_TO_MIDI["C"]), 3.0, amplitude=0.25)
chord_notes = generate_chord_sound(notes, 3.0, amplitude=0.2)
mixed = [bass_note[i] + chord_notes[i] for i in range(len(bass_note))]
start = len(samples_6) / SAMPLE_RATE
timeline_6.append((start, start + 3.0, "C (strong bass)"))
samples_6.extend(mixed)
samples_6.extend([0.0] * int(SAMPLE_RATE * 0.3))

write_wav("06_bass_variation.wav", samples_6)
print(f"  Timeline: {[(f'{t[2]} @ {t[0]:.1f}-{t[1]:.1f}s') for t in timeline_6]}")


# ============================================================
# Summary
# ============================================================
print(f"\n{'='*60}")
print(f"All test files generated in: {OUTPUT_DIR}")
print(f"Total files: {len([f for f in os.listdir(OUTPUT_DIR) if f.endswith('.wav')])}")
for f in sorted(os.listdir(OUTPUT_DIR)):
    if f.endswith('.wav'):
        size = os.path.getsize(os.path.join(OUTPUT_DIR, f))
        print(f"  {f:45s} {size/1024:7.1f} KB")
