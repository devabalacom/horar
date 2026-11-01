"use client";

import { useEffect, useId, useState } from "react";
import { type Place, searchPlaces } from "@/lib/geo";

/** A city field that looks the name up as you type and keeps the coordinates
 * and time zone of the one you pick. */
export default function CityPicker({ value, onChange }: { value: Place; onChange: (p: Place) => void }) {
  const id = useId();
  const [text, setText] = useState(value.label);
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);

  // A chart opened from a link sets the city after the first render.
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    setText(value.label);
  }

  useEffect(() => {
    if (!open || text === value.label || text.trim().length < 2) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const found = await searchPlaces(text, ctrl.signal);
        setResults(found);
        setActive(0);
      } catch {
        /* aborted by the next keystroke */
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [text, open, value.label]);

  function pick(p: Place) {
    onChange(p);
    setText(p.label);
    setResults([]);
    setOpen(false);
  }

  function onKey(e: React.KeyboardEvent) {
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      pick(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const listOpen = open && results.length > 0;

  return (
    <div className="field city">
      <label htmlFor={`${id}-city`} className="field__label">
        Город
      </label>
      <input
        id={`${id}-city`}
        className="input"
        role="combobox"
        aria-expanded={listOpen}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={listOpen ? `${id}-opt-${active}` : undefined}
        autoComplete="off"
        value={text}
        placeholder="Начните вводить название"
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        onFocus={(e) => e.target.select()}
        onBlur={() =>
          // Lets a click on an option land before the list goes away; a
          // half-typed name falls back to the city still in use.
          setTimeout(() => {
            setOpen(false);
            setText((t) => (t === value.label ? t : value.label));
          }, 150)
        }
        onKeyDown={onKey}
      />
      {listOpen && (
        <ul className="city__list" id={`${id}-list`} role="listbox">
          {results.map((p, i) => (
            <li
              key={`${p.label}-${p.lat}`}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? "is-active" : ""}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(p);
              }}
              onMouseEnter={() => setActive(i)}
            >
              {p.label}
            </li>
          ))}
        </ul>
      )}
      <span className="field__hint">
        {loading
          ? "Ищем…"
          : `${value.lat.toFixed(2)}°, ${value.lng.toFixed(2)}° · часовой пояс ${value.tz}`}
      </span>
    </div>
  );
}
