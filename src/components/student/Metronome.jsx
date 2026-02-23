import { useState, useEffect, useRef } from "react";

function Metronome() {
  const [bpm, setBpm] = useState(120);
  const [isActive, setIsActive] = useState(false);
  const audioContextRef = useRef(null);
  const nextNoteTimeRef = useRef(0);
  const scheduleAheadTimeRef = useRef(0.1); // How far ahead to schedule audio (sec)
  const lookAheadTimeRef = useRef(25.0); // How frequently to call scheduling function (ms)
  const lastDrawTimeRef = useRef(-1);
  const timerIDRef = useRef(null);

  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
  }, []);

  useEffect(() => {
    if (isActive) {
      nextNoteTimeRef.current = audioContextRef.current.currentTime;
      scheduler();
    } else if (timerIDRef.current) {
      clearTimeout(timerIDRef.current);
    }

    return () => {
      if (timerIDRef.current) {
        clearTimeout(timerIDRef.current);
      }
    };
  }, [isActive, bpm]);

  const scheduleNote = (time) => {
    const audioContext = audioContextRef.current;
    
    // Create oscillator for click sound
    const osc = audioContext.createOscillator();
    const env = audioContext.createGain();
    
    osc.frequency.value = 800;
    osc.type = "sine";
    
    osc.connect(env);
    env.connect(audioContext.destination);
    
    env.gain.setValueAtTime(0.3, time);
    env.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
    
    osc.start(time);
    osc.stop(time + 0.1);
  };

  const nextNote = () => {
    const secondsPerBeat = 60.0 / bpm;
    nextNoteTimeRef.current += secondsPerBeat;
  };

  const scheduler = () => {
    const audioContext = audioContextRef.current;
    
    // Schedule all notes that fall within look-ahead window
    while (nextNoteTimeRef.current < audioContext.currentTime + scheduleAheadTimeRef.current) {
      scheduleNote(nextNoteTimeRef.current);
      nextNote();
    }
    
    timerIDRef.current = setTimeout(scheduler, lookAheadTimeRef.current);
  };

  const toggleMetronome = () => {
    setIsActive(!isActive);
  };

  return (
    <div className="bg-white rounded-lg p-6 border border-purple-200">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">🎵 Metronome</h3>
      
      <div className="space-y-4">
        {/* BPM Display and Control */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tempo: <span className="text-2xl font-bold text-purple-600">{bpm} BPM</span>
          </label>
          <input
            type="range"
            min="40"
            max="300"
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            disabled={isActive}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>40</span>
            <span>150</span>
            <span>300</span>
          </div>
        </div>

        {/* Play/Stop Button */}
        <button
          onClick={toggleMetronome}
          className={`w-full py-3 rounded-lg font-semibold text-white transition ${
            isActive
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-purple-600 hover:bg-purple-700'
          }`}
        >
          {isActive ? '⏹ Stop Metronome' : '▶ Start Metronome'}
        </button>

        {/* Status */}
        <div className="text-center">
          {isActive && (
            <div className="inline-flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-600">Metronome active</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Metronome;
