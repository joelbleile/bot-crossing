/**
 * A slow, generative pad: long soft chords that melt into each other, nothing else.
 *
 * Nothing is recorded. Each chord is detuned sine voices through a low-pass, with a faint
 * echo for room. The loop (C maj7, A min7, F maj7, G6) is in one key, so it cannot clash, and
 * every chord fades in and out over several seconds so there is no pulse or twinkle to tire
 * the ear.
 *
 * Scheduling is look-ahead on the audio clock: a timer wakes twice a second and queues what
 * falls in the next few seconds, which keeps timing steady when the tab is busy.
 */

const NOTE = (midi) => 440 * 2 ** ((midi - 69) / 12)
/** Chord tones, in MIDI. Low to high, kept inside one octave and a half so the pad stays warm. */
const CHORDS = [
  [48, 55, 59, 64], // C maj7
  [45, 52, 55, 60], // A min7
  [41, 48, 52, 57], // F maj7
  [43, 50, 55, 59], // G6
]
const CHORD_SECONDS = 12
const LOOKAHEAD = 4

export class Music {
  constructor(ctx, dest) {
    this.ctx = ctx
    this.out = ctx.createGain()
    this.out.gain.value = 1

    // A little space: a dark feedback delay mixed in under the dry signal.
    const delay = ctx.createDelay(1)
    delay.delayTime.value = 0.42
    const feedback = ctx.createGain()
    feedback.gain.value = 0.2
    const tone = ctx.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = 1800
    const wet = ctx.createGain()
    wet.gain.value = 0.25
    this.bus = ctx.createGain()
    this.bus.connect(this.out)
    this.bus.connect(delay)
    delay.connect(tone)
    tone.connect(feedback)
    feedback.connect(delay)
    tone.connect(wet)
    wet.connect(this.out)
    this.out.connect(dest)

    this._nextChord = ctx.currentTime + 0.2
    this._chord = 0
    this._timer = setInterval(() => this._schedule(), 500)
    this._schedule()
  }

  _schedule() {
    const horizon = this.ctx.currentTime + LOOKAHEAD
    while (this._nextChord < horizon) {
      this._pad(CHORDS[this._chord % CHORDS.length], this._nextChord)
      this._chord++
      this._nextChord += CHORD_SECONDS
    }
  }

  _pad(notes, at) {
    const { ctx } = this
    const end = at + CHORD_SECONDS + 5
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 900
    const env = ctx.createGain()
    env.gain.setValueAtTime(0, at)
    env.gain.linearRampToValueAtTime(0.09, at + 5)
    env.gain.setValueAtTime(0.09, at + CHORD_SECONDS)
    env.gain.linearRampToValueAtTime(0, end)
    filter.connect(env)
    env.connect(this.bus)
    for (const note of notes) {
      // Two slightly detuned sines per note give the pad a slow, gentle shimmer.
      for (const cents of [-6, 6]) {
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = NOTE(note)
        osc.detune.value = cents
        osc.connect(filter)
        osc.start(at)
        osc.stop(end + 0.1)
      }
    }
  }

  setVolume(v, now = this.ctx.currentTime) {
    this.out.gain.setTargetAtTime(v, now, 0.05)
  }

  dispose() {
    clearInterval(this._timer)
    try {
      this.out.disconnect()
    } catch {}
  }
}
