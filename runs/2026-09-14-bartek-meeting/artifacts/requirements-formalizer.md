intent: create

## Confirmed requirements

- **when**: 2026-09-14 (today, Monday), 14:30
- **who**: ["Bartek"]
- **where**: "Galeria Północna" (to be validated/enriched by location-resolver; likely the shopping mall in Warsaw, Białołęka)

## Open questions

- Is "Bartek" a first name only — should the full name be confirmed/disambiguated (e.g., in case there are multiple contacts named Bartek)?
- The request says "meeting with Bartek" but does not name the requester explicitly. Per the domain model, `who` is just a list of attendee name strings with no implicit "self" record, so `who = ["Bartek"]` is treated as a non-empty, valid attendee list. If the requester intends to be listed as a separate named attendee, that name should be supplied — otherwise no action needed.
</content>
</invoke>
