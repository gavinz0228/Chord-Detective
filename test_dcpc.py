#!/usr/bin/env python3
"""
Comprehensive unit tests for dcpc() — the chord-from-pitch-classes detector.

This is a Python port of the JS function with identical behavior.
Tests account for enharmonic symmetries:
  - aug: 3-fold symmetry (Caug = Eaug = G#aug)
  - dim7: 4-fold symmetry (Cdim7 = D#dim7 = F#dim7 = Adim7)
  - sus2(x) = sus4(x-5): e.g. Csus2 = Gsus4
  - m7(x) = 6(x+2): e.g. Dm7 = F6 (6 not in templates, so m7 is correct)
"""

# ── Chord templates (must match CT_FILE in index.html exactly) ──
CT = [
    {"n": "",     "i": [0, 4, 7]},
    {"n": "m",    "i": [0, 3, 7]},
    {"n": "dim",  "i": [0, 3, 6]},
    {"n": "aug",  "i": [0, 4, 8]},
    {"n": "sus2", "i": [0, 2, 7]},
    {"n": "sus4", "i": [0, 5, 7]},
    {"n": "7",    "i": [0, 4, 7, 10]},
    {"n": "m7",   "i": [0, 3, 7, 10]},
    {"n": "maj7", "i": [0, 4, 7, 11]},
    {"n": "dim7", "i": [0, 3, 6, 9]},
    {"n": "m7b5", "i": [0, 3, 6, 10]},
]

NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def dcpc(pcs):
    """Exact port of the JS dcpc() function."""
    if len(pcs) == 0:
        return {"root": 0, "suffix": "", "confidence": 0}

    best = {"root": 0, "suffix": "", "confidence": float("-inf")}

    for r in range(12):
        for t in CT:
            tp = {(r + iv) % 12 for iv in t["i"]}
            m = 0
            e = 0
            for pc in pcs:
                if pc in tp:
                    m += 1
                else:
                    e += 1
            root_bonus = 0.005 if (r in pcs and m < len(tp)) else 0
            s = (m / len(tp)) - e * 0.15 - (0.05 if len(t["i"]) > 3 else 0) + root_bonus
            if s > best["confidence"]:
                best = {
                    "root": r,
                    "suffix": t["n"],
                    "confidence": max(0.0, min(1.0, s)),
                }
    return best


def chord_name(result):
    return NOTE_NAMES[result["root"]] + result["suffix"]


# ── Symmetry helpers ──
def aug_equivalent_roots(root):
    """All roots of the same augmented triad (3-fold symmetry)."""
    return {(root + i * 4) % 12 for i in range(3)}


def dim7_equivalent_roots(root):
    """All roots of the same diminished 7th chord (4-fold symmetry)."""
    return {(root + i * 3) % 12 for i in range(4)}


def sus2_sus4_equivalent(sus2_root):
    """Csus2 {0,2,7} == Gsus4 {7,0,2}. Returns matching sus4 root."""
    return (sus2_root + 7) % 12  # sus2 at root = sus4 at root+7


# ────────────────────────────────────────────────────────────
#  TEST SUITE
# ────────────────────────────────────────────────────────────

PASS = 0
FAIL = 0


def check(label, pcs, expected_root, expected_suffix, min_conf=0.0,
          equivalent_checks=None):
    """
    Run a test. If equivalent_checks is provided, it's a list of
    (root, suffix) tuples that are also considered correct
    (for symmetric chords).
    """
    global PASS, FAIL
    result = dcpc(set(pcs))

    # Build list of acceptable results
    acceptable = [(expected_root, expected_suffix)]
    if equivalent_checks:
        acceptable.extend(equivalent_checks)

    ok = any(
        result["root"] == r and result["suffix"] == s
        for r, s in acceptable
    ) and result["confidence"] >= min_conf

    status = "✓" if ok else "✗"
    if ok:
        PASS += 1
    else:
        FAIL += 1

    print(
        f"  {status} {label:45s} → {chord_name(result):6s} "
        f"(conf={result['confidence']:.3f})  "
        f"expected {NOTE_NAMES[expected_root]}{expected_suffix}",
        end=""
    )
    if not ok:
        print("  ← MISMATCH", end="")
    print()


def section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


# ═══════════════════════════════════════════════════════════
section("1. PERFECT MATCHES — every template at every root")

for root in range(12):
    for t in CT:
        pcs = {(root + iv) % 12 for iv in t["i"]}

        # Build equivalence list for symmetric chord types
        eq = []
        if t["n"] == "aug":
            for r in aug_equivalent_roots(root):
                if r != root:
                    eq.append((r, "aug"))
        elif t["n"] == "dim7":
            for r in dim7_equivalent_roots(root):
                if r != root:
                    eq.append((r, "dim7"))
        elif t["n"] == "sus2":
            eq.append((sus2_sus4_equivalent(root), "sus4"))
        elif t["n"] == "sus4":
            eq.append(((root + 5) % 12, "sus2"))  # inverse: sus4 at root = sus2 at root+5

        check(
            f"{NOTE_NAMES[root]}{t['n']} perfect",
            pcs,
            root,
            t["n"],
            min_conf=0.9,
            equivalent_checks=eq,
        )

# ═══════════════════════════════════════════════════════════
section("2. INCOMPLETE CHORDS — missing notes")

check("C power chord {0,7}", {0, 7}, 0, "", min_conf=0.5)
check("C no-3rd {0,7}", {0, 7}, 0, "", min_conf=0.5)
check("C missing 5th {0,4}", {0, 4}, 0, "", min_conf=0.55)
check("Cm missing 5th {0,3}", {0, 3}, 0, "m", min_conf=0.55)
check("C-Eb dyad {0,3}", {0, 3}, 0, "m", min_conf=0.5)
check("C solo {0}", {0}, 0, "", min_conf=0.2)
check("C7 missing 5th {0,4,10}", {0, 4, 10}, 0, "7", min_conf=0.65)
check("Cmaj7 missing 5th {0,4,11}", {0, 4, 11}, 0, "maj7", min_conf=0.65)

# ═══════════════════════════════════════════════════════════
section("3. EXTRA NOTES — chord + passing tones")

check("C add9 {0,2,4,7}", {0, 2, 4, 7}, 0, "", min_conf=0.7)
# C6 = {C,E,G,A} = {0,4,7,9} which equals Am7 {A,C,E,G}. Algorithm picks Am7
# because m7 is a template (score 0.95) vs major+extra (score 0.85).
check("C6 is Am7 pitch set {0,4,7,9}", {0, 4, 7, 9}, 9, "m7", min_conf=0.7)
check("C(#5) or C w/b6 {0,4,7,8}", {0, 4, 7, 8}, 0, "", min_conf=0.7)
check("C lydian-ish {0,4,6,7}", {0, 4, 6, 7}, 0, "", min_conf=0.6)

# ═══════════════════════════════════════════════════════════
section("4. AMBIGUOUS SETS — multiple interpretations")

# Csus2 {0,2,7} = Gsus4 {7,0,2} → algorithm picks sus2 (template order)
check("Csus2 / Gsus4 {0,2,7}", {0, 2, 7}, 0, "sus2", min_conf=0.9,
      equivalent_checks=[(7, "sus4")])

# C6/Am7 {0,4,7,9} → algorithm picks Am7 (m7 template > major+extra)
check("C6 / Am7 {0,4,7,9}", {0, 4, 7, 9}, 9, "m7", min_conf=0.7)
# Note: C6 is not a template. Am7 {A,C,E,G} = {9,0,4,7} is. This is correct.

# Dm7/F6 {0,2,5,9} → Dm7 (m7 template)
check("Dm7 / F6 {0,2,5,9}", {0, 2, 5, 9}, 2, "m7", min_conf=0.7)
# F6 also not a template. Dm7 is correct.

# dim7 symmetry: Cdim7 = D#dim7 = F#dim7 = Adim7
eq_dim7 = [(3, "dim7"), (6, "dim7"), (9, "dim7")]
check("Cdim7 {0,3,6,9}", {0, 3, 6, 9}, 0, "dim7", min_conf=0.9,
      equivalent_checks=eq_dim7)

# ═══════════════════════════════════════════════════════════
section("5. TRIAD vs 7th — when the 7th is/isn't present")

check("C major, NOT Cmaj7 {0,4,7}", {0, 4, 7}, 0, "", min_conf=0.9)
result = dcpc({0, 4, 7})
assert result["suffix"] != "maj7", f"Triad misdetected as maj7: {result}"
PASS += 1  # assert passed

check("Cmaj7 actual {0,4,7,11}", {0, 4, 7, 11}, 0, "maj7", min_conf=0.8)
check("C7 actual {0,4,7,10}", {0, 4, 7, 10}, 0, "7", min_conf=0.8)
check("Cm7 actual {0,3,7,10}", {0, 3, 7, 10}, 0, "m7", min_conf=0.8)
check("Cm7b5 actual {0,3,6,10}", {0, 3, 6, 10}, 0, "m7b5", min_conf=0.8)

# ═══════════════════════════════════════════════════════════
section("6. RELATIVE MAJOR / MINOR — should not confuse")

check("C major {0,4,7}", {0, 4, 7}, 0, "", min_conf=0.9)
check("Am {9,0,4}", {9, 0, 4}, 9, "m", min_conf=0.9)
check("Dm {2,5,9}", {2, 5, 9}, 2, "m", min_conf=0.9)
check("F major {5,9,0}", {5, 9, 0}, 5, "", min_conf=0.9)
check("G major {7,11,2}", {7, 11, 2}, 7, "", min_conf=0.9)
check("Em {4,7,11}", {4, 7, 11}, 4, "m", min_conf=0.9)

# ═══════════════════════════════════════════════════════════
section("7. EDGE CASES")

check("empty {}", set(), 0, "", min_conf=0.0)
result = dcpc(set())
assert result["confidence"] == 0, "Empty set should have confidence 0"
PASS += 1

check("single C {0}", {0}, 0, "", min_conf=0.2)

check("C+E dyad {0,4}", {0, 4}, 0, "", min_conf=0.5)
result = dcpc({0, 4})
assert result["suffix"] != "m", f"Major dyad detected as minor: {result}"
PASS += 1

check("C+Eb dyad {0,3}", {0, 3}, 0, "m", min_conf=0.5)

# Full chromatic cluster
all12 = set(range(12))
result = dcpc(all12)
print(f"  → Chromatic cluster → {chord_name(result)} (conf={result['confidence']:.3f})")
assert result["confidence"] <= 0.1, "Chromatic cluster should have very low confidence"
PASS += 1

# ═══════════════════════════════════════════════════════════
section("8. INVERSIONS — same pitch-class set, different ordering")

check("C/E inversion {4,7,0}", {4, 7, 0}, 0, "", min_conf=0.9)
check("C/G inversion {7,0,4}", {7, 0, 4}, 0, "", min_conf=0.9)
check("Dm/F inversion {5,9,2}", {5, 9, 2}, 2, "m", min_conf=0.9)

# ═══════════════════════════════════════════════════════════
section("9. SCORING BIAS — triads should NOT be detected as 7ths")

for root in range(12):
    for triad_name, seventh_name in [("", "7"), ("", "maj7"), ("m", "m7")]:
        triad_t = next(t for t in CT if t["n"] == triad_name)
        seventh_t = next(t for t in CT if t["n"] == seventh_name)
        pcs = {(root + iv) % 12 for iv in triad_t["i"]}
        result = dcpc(pcs)
        assert result["suffix"] != seventh_name, (
            f"Triad {NOTE_NAMES[root]}{triad_name} misdetected as "
            f"{seventh_name}: {result}"
        )
PASS += 36  # 12 roots × 3 triad pairs

print(f"  ✓ All 36 triad-vs-7th pairs verified")

# ═══════════════════════════════════════════════════════════
section("10. STRESS TEST — random 3-7 note sets")

import random

random.seed(42)
for i in range(200):
    size = random.randint(3, 7)
    pcs = set(random.sample(range(12), min(size, 12)))
    result = dcpc(pcs)
    assert 0 <= result["root"] <= 11, f"root out of range: {result}"
    assert result["suffix"] in [
        "", "m", "dim", "aug", "sus2", "sus4",
        "7", "m7", "maj7", "dim7", "m7b5",
    ], f"unknown suffix: {result}"
    assert 0.0 <= result["confidence"] <= 1.0, f"confidence out of range: {result}"
PASS += 200

print(f"  ✓ 200 random sets all returned valid chord names within [0,1] confidence")

# ═══════════════════════════════════════════════════════════
section("11. REAL-WORLD SCENARIOS")

# Jazz: Dm7-G7-Cmaj7
check("Dm7 jazz {2,5,9,0}", {2, 5, 9, 0}, 2, "m7", min_conf=0.7)
check("G7 jazz {7,11,2,5}", {7, 11, 2, 5}, 7, "7", min_conf=0.7)
check("Cmaj7 jazz {0,4,7,11}", {0, 4, 7, 11}, 0, "maj7", min_conf=0.8)

# Pop: I-V-vi-IV in C
check("C pop {0,4,7}", {0, 4, 7}, 0, "", min_conf=0.9)
check("G pop {7,11,2}", {7, 11, 2}, 7, "", min_conf=0.9)
check("Am pop {9,0,4}", {9, 0, 4}, 9, "m", min_conf=0.9)
check("F pop {5,9,0}", {5, 9, 0}, 5, "", min_conf=0.9)

# Blues: C7-F7-G7
check("C7 blues {0,4,7,10}", {0, 4, 7, 10}, 0, "7", min_conf=0.8)
check("F7 blues {5,9,0,3}", {5, 9, 0, 3}, 5, "7", min_conf=0.8)
check("G7 blues {7,11,2,5}", {7, 11, 2, 5}, 7, "7", min_conf=0.8)

check("C5 w harmonic bleed {0,4,7}", {0, 4, 7}, 0, "", min_conf=0.9)

# ═══════════════════════════════════════════════════════════
section("12. ROOT-PRESENCE BONUS — prefer chords whose root is in the input")

# The classic bug: {A,G,Bb} was misdetected as Dsus4 because D isn't in the input
# With the 0.005 root-presence bonus, Gm should win (G IS in {A,G,Bb})
check("A,G,Bb → Gm (not Dsus4) {9,7,10}", {9, 7, 10}, 7, "m", min_conf=0.5)

# But perfect Dsus4 {D,G,A} should still be Dsus4
check("D,G,A → Dsus4 (perfect) {2,7,9}", {2, 7, 9}, 2, "sus4", min_conf=0.9)

# Power chord {C,G} → root C is present, should be C major
check("C power {0,7} → C (root bonus)", {0, 7}, 0, "", min_conf=0.5)

# {E,G,Bb} = Edim = {4,7,10}. Root E=4, G=7 both in input.
# Edim: m=3, e=0, no bonus (perfect). G7 missing B? No...
# Actually {4,7,10} = Edim perfectly. The bonus doesn't apply.
check("Edim {4,7,10}", {4, 7, 10}, 4, "dim", min_conf=0.9)

# {C,Eb,Gb,A} = Cdim7 = {0,3,6,9}. Roots: C(0) in input.
check("Cdim7 root bonus {0,3,6,9}", {0, 3, 6, 9}, 0, "dim7", min_conf=0.8)

# {2,5,9} = D,F,A = Dm. Also could be F {5,9,0} → missing 0.
# Dm: m=3, e=0, no bonus. Dm wins correctly.
check("Dm {2,5,9} root present", {2, 5, 9}, 2, "m", min_conf=0.9)

# ═══════════════════════════════════════════════════════════
section("13. TEMPLATE COVERAGE")

template_hits = {t["n"]: 0 for t in CT}
for t in CT:
    for root in range(12):
        pcs = {(root + iv) % 12 for iv in t["i"]}
        result = dcpc(pcs)
        template_hits[result["suffix"]] += 1

for name, count in template_hits.items():
    status = "✓" if count > 0 else "✗ NEVER SELECTED!"
    print(f"  {status} \"{name or '(major)'}\" selected {count:3d} times")
    if count > 0:
        PASS += 1
    else:
        FAIL += 1

# ═══════════════════════════════════════════════════════════
section("14. DETERMINISM — same input → same output")

for _ in range(10):
    r1 = dcpc({0, 4, 7, 10})
    r2 = dcpc({0, 4, 7, 10})
    assert r1 == r2, "dcpc is not deterministic!"
PASS += 1
print(f"  ✓ dcpc() is deterministic (10 runs, same output)")

# ═══════════════════════════════════════════════════════════
section("15. CONFIDENCE MONOTONICITY — more matching notes → higher confidence")

# Perfect triad should have higher confidence than same triad with an extra note
c_triad = dcpc({0, 4, 7})
c_add9 = dcpc({0, 2, 4, 7})
assert c_triad["confidence"] > c_add9["confidence"], (
    f"Perfect triad conf {c_triad['confidence']} should exceed "
    f"extra-note conf {c_add9['confidence']}"
)
PASS += 1
print(f"  ✓ Perfect triad confidence ({c_triad['confidence']:.3f}) > "
      f"extra note confidence ({c_add9['confidence']:.3f})")

# Full 7th chord should have higher confidence than triad w/ same root note set
c7_full = dcpc({0, 4, 7, 10})
c7_as_triad = dcpc({0, 4, 7})  # same as C major
# C7 scores 0.95, C major scores 1.0 — but these are different chord types
# Actually the confidence measures fitness to a specific template, not absolute certainty
# So this monotonicity check doesn't apply — skip

# ═══════════════════════════════════════════════════════════
section("RESULTS")

total = PASS + FAIL
print(f"\n  PASS: {PASS} / {total}  ({PASS/total*100:.1f}%)")
print(f"  FAIL: {FAIL} / {total}")

if FAIL > 0:
    print(f"\n  ❌ {FAIL} TESTS FAILED!")
    exit(1)
else:
    print(f"\n  ✅ ALL TESTS PASSED!")
    exit(0)
