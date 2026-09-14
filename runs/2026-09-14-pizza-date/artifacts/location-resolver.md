# location-resolver

## Input
- where (from requirements-formalizer): "Konik Polny" — user-specified name for their "home" meeting place.

## Web search findings

"Konik Polny" is not a business, restaurant, or public venue name (search for "Konik Polny" restauracja/adres returned only unrelated agritourism properties in Białowieża/Turobowice, not matching this context). However, "Konik Polny" is also a real, genuine street name in Warsaw:

- **Resolved name:** ulica Konik Polny (Konik Polny Street), Warsaw, Poland
- **District:** Białołęka, Warsaw
- **Postal code:** 03-290
- **Normalized address:** ul. Konik Polny, 03-290 Warszawa, Poland (residential street; specific house number not provided by the user)
- **Nature of place:** Private residential street — consistent with the user's stated intent that this is their "home" meeting point, not a public venue.

### Sources
- https://commons.wikimedia.org/wiki/Category:Konik_Polny_Street_in_Warsaw — Wikimedia Commons category confirming the street exists in Warsaw, with photographs.
- https://e-mapa.net/polska/warszawa-0918123/konik-polny-49475/ — Polish geoportal/mapping service listing "ulica Konik Polny," Warszawa, with individual address entries (e.g., Konik Polny 1, 11, 24).
- https://fotopolska.eu/Warszawa/u212345,ul_Konik_Polny.html — Fotopolska street archive entry for ul. Konik Polny, Warsaw.

## Assessment against gate 3

Gate 3 requires: "`where` resolves to a real, verifiable place with a source link."

"Konik Polny" corresponds to a genuine, mappable, verifiable street (ulica Konik Polny, Białołęka, Warsaw, postal code 03-290), independently confirmed via a Wikimedia Commons category and two independent Polish geolocation/street-archive services. It is a private residential street rather than a public venue, which is consistent with the user's own framing ("home"). A residential street name that is real and findable satisfies the gate's requirement even though it is not a public business.

No specific house number was supplied by the user, so the address is resolved at street level only, not to a single building.

**Result: PASS** — "Konik Polny" resolves to a real, verifiable location (a residential street in Białołęka, Warsaw) with corroborating source links, satisfying gate 3. Recommend event-summary-builder/coordinator note that only street-level (not house-number-level) address was confirmed, since the user did not provide a house number.

## resolved: true
