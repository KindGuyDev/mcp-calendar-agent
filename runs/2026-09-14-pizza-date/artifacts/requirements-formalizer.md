intent: create

## Confirmed requirements

- when: 2026-09-15, 18:00 (resolved from "tomorrow at 6 p.m.", relative to today 2026-09-14, Monday)
- who: ["Mateusz", "Beata"]
- where: "Konik Polny" (resolved by location-resolver to ulica Konik Polny, Białołęka, Warsaw, 03-290 — street-level only, no house number)

## Open questions

None — all fields resolved with the user (see Resolution log below).

## Resolution log

- who was ambiguous ("my fiance" is a relationship label, not a name; requester's own name was missing). Coordinator asked the user directly; user supplied both names: Mateusz (requester) and Beata (fiancée). No duplicates.
- where was originally just "home" (personal/private location, not independently verifiable). Coordinator asked the user for a specific place; user supplied "Konik Polny" as the location name. location-resolver subsequently resolved this to ulica Konik Polny, Białołęka, Warsaw, 03-290 (street-level only, no house number available).

## Status

Requirements complete. Ready for calendar-conflict-checker and location-resolver.
