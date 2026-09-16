# Species Habitat Assessment and Conservation Plan (Example Report)

FR422 Forest Wildlife and Habitat, Semester 2, 2026

EXAMPLE ONLY. Do not submit this report. Your Part B must use your own species, maps, thresholds, and citations. Copy the structure, not the content.

Species: Emperor Bird-of-paradise, *Paradisaea guilielmi* (Cabanis, 1888)
IUCN Red List category: Near Threatened (BirdLife International, n.d.; accessed 15 September 2026)
Student: [Full Name]    Student ID: [ID number]    Date: [submission date]

---

## 1. Species and study area

The Emperor Bird-of-paradise is endemic to the Huon Peninsula, PNG, in hill and lower montane forest at 450 to 1,500 m (Australian Museum, n.d.). The IUCN lists it as Near Threatened (BirdLife International, n.d.). The study area is the convex hull of 128 GBIF records (56 unique sites) in Morobe Province (Figure 1). Hull area is 776,895 ha (EPSG:32755). This is desk-based, written from the five maps and literature.

## 2. Map results

Environmental gradient (Figure 2). tree_cover_pct ranges 1 to 100% (mean 92.6). 115 of 128 records have tree cover at or above 90%. The species is recorded almost exclusively in closed-canopy forest. Elevation spans 15 to 2,664 m, rainfall 2,230 to 3,951 mm, matching the published habitat description (Australian Museum, n.d.).

Spatial pattern (Figure 3). Gi* (distance band 53.87 km, FDR-corrected) found 100 hot spots at 99% confidence, 14 cold spots at 99%, 14 not significant (89.1% significant). Hot spots form a continuous high-tree-cover block across the peninsula's hill forest. Cold spots mark degraded habitat. Stacked coordinates present (128 records, 56 sites).

Habitat proxy (Figure 4). habitat_score ranges 0 to 3 (mean 2.742). 123 of 128 records score at or above 2. Not a species distribution model.

Gap analysis (Figures 5 and 6). 43,755 ha (5.6%) of the hull is inside protected areas (Nusareng and YUS). 734,995 ha (94.4%) is unprotected. 111 of 128 high-quality records are outside any protected area.

## 3. Ranked threats

1. Logging of hill forest (rank 1). The hot-spot block in Figure 3 is the species' core habitat. Logging removes it. Ranked first because 94.4% of the hull is unprotected and logging is the identified threat (Australian Museum, n.d.).

2. Hunting for ceremonial plumes (rank 2). Birds-of-paradise are hunted for traditional headdresses (Supuma, 2018). From literature, not the lab file. Ranked second because hunting is dispersed while logging removes habitat permanently.

3. Garden expansion at forest edges (rank 3). The 14 cold spots in Figures 2 and 3 mark garden edges with reduced canopy. Ranked third because the species persists in forest pockets within gardens (Australian Museum, n.d.).

## 4. Conservation actions

Action 1: Protect the hot-spot block with a Wildlife Management Area under the Fauna (Protection and Control) Act 1966. Targets the 111 unprotected high-quality records (Figure 6). Addresses logging and hunting.

Action 2: Restore the cold-spot cluster with a Conservation Area under the Conservation Areas Act 1978. Adds habitat Action 1 does not cover.

Action 3: Protect forest patches in the garden mosaic through community forest agreements. The species persists in these pockets (Australian Museum, n.d.).

Land in PNG is under customary tenure. The file records no clan names, so this plan cannot name them. Any action needs clan consent in practice.

## 5. Monitoring

Re-run Gi* on updated tree cover. Re-run the gap analysis after new protected areas. Action 1 fails if the 99% hot-spot count drops below 90 of 128 within five years, or if the protected proportion stays at 5.6% two years after gazettal. Action 2 fails if the cold-spot count exceeds 14. Action 3 fails if records with tree_cover_pct below 50 exceed 13.

## 6. Limitations

GBIF teaching extract, not a census. 128 records at 56 sites, stacked coordinates. No forest-change layer, no field data. Desk-based plan, not a field assessment. The habitat proxy is not a species distribution model. Hull area is not habitat area.

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
