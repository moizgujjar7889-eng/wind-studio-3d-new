import { Shirt, MapPin, ChevronDown } from 'lucide-react';
import { CHARACTERS } from '../lib/characters';
import { LOCATION_LIST } from '../lib/locations';
import type { CharacterPreset, LocationPreset } from '../lib/types';

interface Props {
  character: CharacterPreset;
  location: LocationPreset;
  onCharacter: (c: CharacterPreset) => void;
  onLocation: (l: LocationPreset) => void;
}

export default function StylePanel({ character, location, onCharacter, onLocation }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/50 font-semibold mb-2.5">
          <Shirt className="w-3.5 h-3.5" />
          Character
        </div>
        <div className="grid grid-cols-2 gap-2">
          {CHARACTERS.map((c) => {
            const active = c.id === character.id;
            return (
              <button
                key={c.id}
                onClick={() => onCharacter(c)}
                className={`flex items-center gap-2.5 rounded-xl p-2.5 text-left transition-all border ${
                  active
                    ? 'bg-white/15 border-white/40'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                <span
                  className="w-8 h-8 rounded-full shrink-0 border border-white/20"
                  style={{ background: c.dressColor }}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-white truncate">{c.name}</span>
                  <span className="block text-[10px] text-white/50 truncate">{c.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/50 font-semibold mb-2.5">
          <MapPin className="w-3.5 h-3.5" />
          Location
        </div>
        <div className="flex flex-col gap-1.5">
          {LOCATION_LIST.map((l) => {
            const active = l.id === location.id;
            return (
              <button
                key={l.id}
                onClick={() => onLocation(l)}
                className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-left transition-all border ${
                  active ? 'bg-white/15 border-white/40' : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                <span>
                  <span className="block text-sm font-semibold text-white">{l.name}</span>
                  <span className="block text-[10px] text-white/50">{l.description}</span>
                </span>
                {active && <ChevronDown className="w-4 h-4 text-white/60 -rotate-90" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
