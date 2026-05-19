# anna-automatisera-rapport

## Om projektet

Anna jobbar som SEO-konsult och vill automatisera analysen av SEO-data.

Problemet: Hon hämtar data manuellt från fyra verktyg, tolkar vad den betyder och skriver sedan texten till kunden — allt tar lång tid.

Lösningen: Ett verktyg där hon klistrar in data, väljer kund och period, och får tillbaka en färdig analys och rapporttext.

## Datakällor

- Google Search Console (klick, impressions, brand vs non-brand)
- GA4 (organisk trafik, konverteringar, trafik från AI-verktyg)
- Sistrix (synlighetsindex)
- Wincher (rankingar)

## Rapporter innehåller

- Rankingar
- Trafik, klick, impressions (brand, non-brand, hela sajten)
- Konverteringar från organisk trafik
- Trafik från AI-verktyg (GA4)
- Synlighet (Sistrix)
- Förändringar mot föregående månad och föregående år

## Rapportformat

- Vissa kunder: e-post på svenska
- Vissa kunder: Google Slides-presentation (möte)
- Alla kunder: dashboard i Looker Studio
- Språk: svenska som standard, engelska för vissa kunder

## Design

Ren och modern — mycket luft, minimalt, ljusa färger

## Teknik

- Byggs med HTML, CSS och JavaScript
- Ingen React, inget byggsteg
- Kod sparas på GitHub
- Sidan publiceras med Vercel
- Data sparas i Supabase
- AI-analys via Claude API (Vercel serverless function)

## Övrigt

- Anna sitter på Mac
