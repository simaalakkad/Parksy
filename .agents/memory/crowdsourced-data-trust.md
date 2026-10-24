---
name: Crowdsourced data trust
description: Why community availability reports remain separate from source inventory and use anonymous device recognition.
---

Keep qualitative community reports separate from operator/imported inventory. Do not invent a numeric free-space count or overwrite source timestamps after a person reports “Spot available” or “Full.”

**Why:** Those two choices establish an availability signal, not a verified count. Overwriting source inventory would destroy provenance and falsely imply that a person counted the whole lot.

**How to apply:** Combine reports into the single displayed status, keep source counts truthful, and explain the distinction on cards. Treat “Spot available” conservatively unless fresh inventory also supports a high-availability color.

Anonymous signed-cookie limits are intentionally browser/device recognition, not proof of a physical device. Do not claim that they prevent a person clearing cookies or changing browsers.

**Why:** The app has no required accounts or physical-device attestation; adding invasive fingerprinting was not part of the requested reporting flow.

**How to apply:** Preserve the server-enforced cooldown and anonymous reporting. Any stronger identity/anti-abuse mechanism needs a separate privacy/product decision.
