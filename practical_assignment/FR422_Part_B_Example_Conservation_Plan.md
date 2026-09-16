# Species Habitat Assessment and Conservation Plan

FR422 Forest Wildlife and Habitat, Semester 2, 2026

**EXAMPLE ONLY.** Do not submit this report. Your Part B must use your own species, maps, thresholds, and citations. Copy the structure, not the content.

**How to use this example:** Read it to see the structure and the length to aim for (about 800 to 1,000 words). Each section does one job. Write in full sentences, one idea per paragraph. Use active voice ("I propose", "The map shows"). Keep it simple and direct.

**Species:** Emperor Bird-of-paradise, *Paradisaea guilielmi* (Cabanis, 1888)
**IUCN Red List category:** Near Threatened (BirdLife International, n.d.; accessed 15 September 2026)
**Student:** [Full Name]
**Student ID:** [ID number]
**Date:** [submission date]

---

## 1. Species and study area

The Emperor Bird-of-paradise is found only on the Huon Peninsula in Papua New Guinea. It lives in hill and lower montane forest between 450 and 1,500 metres elevation (Australian Museum, n.d.). The IUCN lists it as Near Threatened because of its small range and its need for intact forest (BirdLife International, n.d.).

For this assessment, the study area is the convex hull drawn around 128 GBIF occurrence records (56 unique sites) in Morobe Province (Figure 1). The hull covers 776,895 hectares in EPSG:32755. This is the area of the polygon, not the forest area and not the species' full range. This is a desk-based plan. I did not visit the sites or consult communities. The plan is built from the five maps, the GeoSpaX statistics, and published literature.

## 2. Map results

**Map 2 (Figure 2)** shows that tree cover at the record sites ranges from 1 to 100%, with a mean of 92.6%. Most records (115 of 128) have tree cover at or above 90%, so the species is recorded almost entirely in closed-canopy forest. Elevation ranges from 15 to 2,664 m and rainfall from 2,230 to 3,951 mm, which matches the published habitat description (Australian Museum, n.d.).

**Map 3 (Figure 3)** used Getis-Ord Gi* with a 53.87 km distance band and FDR correction. It found 100 hot spots at 99% confidence, 14 cold spots at 99%, and 14 records that were not significant. That means 89.1% of records are significant, so the spatial pattern is strongly non-random. The hot spots form one continuous block of high tree cover across the hill forest of the peninsula. The cold spots mark areas of degraded or open habitat. Because the file has 128 records but only 56 unique sites, stacked coordinates are present and the results carry that caveat.

**Map 4 (Figure 4)** is the habitat proxy. The habitat_score ranges from 0 to 3 with a mean of 2.742. Of 128 records, 123 score at or above 2, meaning most sites meet at least two of the three environmental criteria (elevation, tree cover, rainfall). This is a proxy of known sites only. It is not a species distribution model.

**Map 5 (Figures 5 and 6)** is the gap analysis. Only 43,755 ha (5.6%) of the hull falls inside existing protected areas (Nusareng and YUS). The remaining 734,995 ha (94.4%) is unprotected. The Priority Area Identification tool found 111 of 128 high-quality records outside any protected area, 12 already protected, and 5 below the score threshold.

## 3. Ranked threats

**1. Logging of hill forest.** The hot-spot block in Figure 3 is the species' core habitat. Logging would remove this block. I rank this first because 94.4% of the hull is unprotected (Figure 5) and logging is the threat identified for this species in the literature (Australian Museum, n.d.).

**2. Hunting for ceremonial plumes.** Birds-of-paradise are hunted in PNG for traditional headdresses (Supuma, 2018). This threat comes from the literature, not from the lab file, which records no hunting. I rank it second because hunting pressure is dispersed, while logging removes habitat permanently and at scale.

**3. Garden expansion at forest edges.** The 14 cold spots in Figures 2 and 3 mark garden edges where canopy cover is reduced. I rank this third because the species can persist in forest pockets within gardens (Australian Museum, n.d.), so this habitat is degraded but not necessarily lost.

## 4. Conservation actions

**Action 1: Protect the hot-spot block.** I propose a Wildlife Management Area under the Fauna (Protection and Control) Act 1966 over the contiguous 99% Gi* hot-spot block (Figure 3). This targets the 111 unprotected high-quality records identified in Figure 6. It addresses logging (threat 1) and hunting (threat 2).

**Action 2: Restore the cold-spot cluster.** I propose a Conservation Area under the Conservation Areas Act 1978 over the degraded cold-spot cluster (Figure 3) with community-led forest restoration. This adds habitat that Action 1 does not cover.

**Action 3: Protect forest patches in the garden mosaic.** I propose community forest agreements to retain forest patches at the low-cover sites (Figure 2). The species persists in these pockets within gardens (Australian Museum, n.d.).

Nearly all land in PNG is under customary tenure, meaning the clans who live on the land own it. The file records no clan names, so this plan cannot name them. Any action would need clan consent in practice.

## 5. Monitoring

Monitoring means re-running the GeoSpaX tools if new data comes in. I would re-run Gi* on updated tree cover at the same 53.87 km band, and re-run the gap analysis after any new protected areas are gazetted.

Action 1 has failed if the 99% hot-spot count drops below 90 of 128 within five years, or if the protected proportion stays at 5.6% two years after gazettal. Action 2 has failed if the cold-spot count rises above 14. Action 3 has failed if the number of records with tree cover below 50% rises above 13.

## 6. Limitations

The data are a GBIF teaching extract, not a census. There are 128 records at 56 unique sites, with stacked coordinates. The file has no forest-change layer and no field-verified data. This is a desk-based plan, not a field assessment. It does not include community consultation or ground-truthing. The habitat proxy is not a species distribution model. The hull area is not habitat area.

---

## References

Australian Museum. (n.d.). *Emperor Bird of Paradise*. Retrieved 15 September 2026, from https://australian.museum/about/history/exhibitions/birds-of-paradise/emperor-bird-of-paradise/

BirdLife International. (n.d.). *Emperor Bird-of-paradise Paradisaea guilielmi* [Species factsheet]. Retrieved 15 September 2026, from https://datazone.birdlife.org/species/factsheet/emperor-bird-of-paradise-paradisaea-guilielmi

Conservation Areas Act 1978 (Papua New Guinea).

Fauna (Protection and Control) Act 1966 (Papua New Guinea).

GBIF.org. (2026). *GBIF occurrence data for Paradisaea guilielmi* (course teaching extract, 9 September 2026) [Data set]. Global Biodiversity Information Facility.

Getis, A., and Ord, J. K. (1992). The analysis of spatial association by use of distance statistics. *Geographical Analysis, 24*(3), 189 to 206.

Margules, C. R., and Pressey, R. L. (2000). Systematic conservation planning. *Nature, 405*, 243 to 253.

Protected Areas Act 2023 (Papua New Guinea).

Supuma, D. (2018). *Endemic birds in Papua New Guinea's montane forests: Human use and conservation* [Doctoral thesis, James Cook University]. https://researchonline.jcu.edu.au/58743/

UNEP-WCMC, and IUCN. (2026). *The World Database on Protected Areas (WDPA)* [Data set]. UNEP-WCMC.

---

## Provenance table (attachment)

| Item | Your entry |
| --- | --- |
| Dataset | Issued species, GBIF PNG teaching extract |
| File | Training file (Week 9 lab): lab_Paradisaea_guilielmi_occurrences.geojson. Marked maps: the geojson issued to you. |
| Provider | GBIF public search API; course extract 09 September 2026 |
| URL or course copy | Google Classroom / Google Drive |
| GeoSpaX version | 1.4.2 |
| Access date | 15 September 2026 |
| Species file and number of points mapped | lab_Paradisaea_guilielmi_occurrences.geojson, 128 points (56 unique sites) |
| Attributes used | site, stateProvince, elevation_m, tree_cover_pct, rainfall_mm |
| Source CRS | EPSG:4326 |
| Analysis CRS | EPSG:32755 (WGS 84 / UTM zone 55S) |
| What this file is | GBIF PNG teaching extract of the species issued. Not a census. |
| WDPA layer (Map 5) | PNG_protected_areas.gpkg, WDPA (UNEP-WCMC), via FR422_SHARED_DATA_2026.zip, EPSG:4326, accessed 15 September 2026 |
| Calculate field expression | (elevation_m >= 0 && elevation_m <= 2000 ? 1 : 0) + (tree_cover_pct >= 50 ? 1 : 0) + (rainfall_mm >= 2500 ? 1 : 0) |

---

## Figures

![Figure 1](final_guide_images/image4.png)

Figure 1. Map 1, Study area and sites. Convex hull of *P. guilielmi* records. CRS: EPSG:32755. Source: GBIF PNG teaching extract, 9 September 2026, not a census.

![Figure 2](final_guide_images/image8.png)

Figure 2. Map 2, Attribute map. Graduated classes of tree_cover_pct (5 classes). Source: GBIF PNG teaching extract, 9 September 2026, not a census.

![Figure 3](final_guide_images/image7.png)

Figure 3. Map 3, Spatial pattern. Getis-Ord Gi* on tree_cover_pct, distance band 53.87 km, FDR-corrected, UTM 55S. 100 hot spots at 99%, 14 cold spots at 99%, 14 not significant. Source: GBIF PNG teaching extract, 9 September 2026, not a census.

![Figure 4](final_guide_images/image33.png)

Figure 4. Map 4, Habitat proxy score (habitat_score 0 to 3). Not a species distribution model. Source: GBIF PNG teaching extract, 9 September 2026, not a census.

![Figure 5](final_guide_images/image26.png)

Figure 5. Protection Gap results: hull 776,895 ha, inside protected areas 43,755 ha (5.6%), gap 734,995 ha (94.4%). Protected areas: Nusareng and YUS. Source: WDPA (UNEP-WCMC).

![Figure 6](final_guide_images/image23.png)

Figure 6. Priority Area Identification: 128 total points, 111 priority (high-quality and unprotected), 12 already protected, 5 below threshold. Source: GBIF teaching extract; WDPA (UNEP-WCMC).
