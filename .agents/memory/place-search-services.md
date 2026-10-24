---
name: Public place and walking services
description: Why autocomplete uses Photon and destination distances use a dedicated foot-routing service.
---

Use Photon rather than the public Nominatim endpoint for search-as-you-type. Public Nominatim prohibits autocomplete. Photon explicitly supports it but offers no availability guarantee and throttles excessive use; keep debounce, bounded caches and outbound throttling.

Walking distances must come from a genuine pedestrian routing graph. Do not change a car-only OSRM URL's profile segment to `foot` and assume it becomes pedestrian routing.

**Why:** The user requested free, keyless autocomplete and actual walking distances. FOSSGIS documents separate car/bike/foot servers, a maximum of one request per second, attribution, and a fix-the-map link. Straight-line or driving distances mislabeled as walking would mislead parking decisions.

**How to apply:** Preserve the dedicated FOSSGIS foot endpoint, serial throttling and attribution. If no walking route can be computed, show an unavailable distance explicitly rather than inventing an estimate. Review provider policies before scaling or substituting services: https://github.com/komoot/photon and https://routing.openstreetmap.de/about.html .
