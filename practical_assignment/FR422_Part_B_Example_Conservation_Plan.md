# Species Habitat Assessment and Conservation Plan (Example Report)

FR422 Forest Wildlife and Habitat, Semester 2, 2026

EXAMPLE ONLY. This report was prepared by the lecturer using the training species (Emperor Bird-of-paradise, *Paradisaea guilielmi*) and the training-file maps. Do not submit this report. Your Part B must use your own species, maps, thresholds, and citations. Copy the structure and the way each claim is tied to a map or source, not the content.

Species: Emperor Bird-of-paradise, *Paradisaea guilielmi* (Cabanis, 1888)
IUCN Red List category: Near Threatened (BirdLife International, n.d.; accessed 15 September 2026)
Student: [Surname]    Date: [submission date]

---

## 1. Species and study area

The Emperor Bird-of-paradise is endemic to the Huon Peninsula, PNG, in hill and lower montane forest at 450 to 1,500 m, mainly 670 to 1,350 m (Australian Museum, n.d.). The IUCN lists it as Near Threatened due to its restricted range and dependence on intact forest (BirdLife International, n.d.).

The study area is the convex hull of 128 GBIF records (56 unique sites) on the Huon Peninsula, Morobe Province (Figure 1). Hull area is 776,895 ha (EPSG:32755). This is the area of the enclosing polygon, not forest area and not the species' range. The plan is desk-based, written from the five maps and literature. No fieldwork was done and no communities were consulted.

The five maps build on each other: Map 1 defines the planning boundary, Map 2 describes the environment at each record, Map 3 shows where records cluster, Map 4 ranks habitat quality, and Map 5 compares habitat with existing protection. The conservation plan reads all five together.

## 2. Map results

Environmental gradient (Figure 2). tree_cover_pct ranges 1 to 100% (mean 92.6, median 98.5). 115 of 128 records have tree cover at or above 90%. The species is recorded almost exclusively in closed-canopy forest, with a few low-cover records marking garden-forest edges. Elevation spans 15 to 2,664 m and rainfall 2,230 to 3,951 mm, matching the published habitat description of hill and lower montane forest (Australian Museum, n.d.). The environmental attributes are point samples, so the map shows conditions at the record sites only, not a continuous surface.

Spatial pattern (Figure 3). Gi* (distance band 53.87 km, FDR-corrected) found 100 hot spots at 99% confidence, 14 cold spots at 99%, and 14 not significant (89.1% significant, mean z-score 2.18). The hot spots form a continuous high-tree-cover block across the peninsula's hill forest. This is the priority forest for protection. The cold spots mark degraded or open habitat. Stacked coordinates are present (128 records, 56 sites), so the results are reported with that caveat.

Habitat proxy (Figure 4). habitat_score ranges 0 to 3 (mean 2.742). 123 of 128 records score at or above 2, meaning most recorded sites meet at least two of the three environmental criteria. The proxy combines elevation, tree cover, and rainfall into one ranking that can be mapped and compared with protection status. It is a proxy of known sites only and does not predict where the species could occur.

Gap analysis (Figure 5 and 6). Of the 776,895 ha hull, 43,755 ha (5.6%) is inside protected areas (Nusareng and YUS). 734,995 ha (94.4%) is unprotected. Priority Area Identification found 111 of 128 high-quality records outside any protected area, 12 already protected, and 5 below the score threshold. The gap between habitat quality and existing protection is large: most high-quality recorded habitat has no formal protection.

## 3. Ranked threats

1. Logging of hill forest (rank 1). The species' core habitat coincides with the 99% tree-cover hot-spot block in Figure 3. Logging removes this block. Ranked first because 94.4% of the hull is unprotected (Figure 5) and logging is the identified threat for this species (Australian Museum, n.d.).

2. Hunting for ceremonial plumes (rank 2). Birds-of-paradise are hunted for traditional headdresses and cultural performance (Supuma, 2018). This is from literature, not the lab file. Ranked second because hunting is dispersed while logging removes habitat permanently and at scale.

3. Garden expansion at forest edges (rank 3). The 14 cold spots in Figures 2 and 3 mark garden-forest edges with reduced canopy. Ranked third because the species persists in forest pockets within gardens (Australian Museum, n.d.), so garden-edge habitat is degraded but not lost.

No other threats are ranked. Climate change is not ranked because the file has no time series or future-climate layer, so no effect can be calculated.

## 4. Conservation actions

Action 1: Protect the hot-spot block. Establish a Wildlife Management Area under the Fauna (Protection and Control) Act 1966 over the contiguous 99% Gi* hot-spot block (Figure 3), targeting the 111 unprotected high-quality records (Figure 6). This addresses logging (threat 1) by controlling habitat use, and hunting (threat 2) by allowing WMA rules to regulate plume hunting seasons.

Action 2: Restore the cold-spot cluster. Declare a Conservation Area under the Conservation Areas Act 1978 over the degraded cold-spot cluster (Figure 3) with community-led forest restoration. This adds habitat that Action 1 does not cover, targeting the low-tree-cover cluster rather than the intact block.

Action 3: Protect forest patches in the garden mosaic. Retain forest patches at the low-cover sites (Figure 2) through community forest agreements. The species persists in these pockets within gardens (Australian Museum, n.d.), so these patches connect the two larger actions and improve connectivity.

The three actions cover the intact hill forest, the degraded cluster, and the garden mosaic. They do not duplicate the existing Nusareng or YUS protected areas, and they focus on the smallest area holding most high-quality records.

Land in PNG is under customary tenure, meaning the clans who live on the land own it. The file records no clan names, so this plan cannot name them. Any action would need clan consent in practice.

## 5. Monitoring

This is a desk-based plan, so monitoring means re-running the GeoSpaX analysis if new data comes in. Re-run Gi* on updated tree cover at the same 53.87 km band to see if the hot-spot count changes. Re-run the gap analysis after any new protected areas are gazetted to see if the protected proportion rises above 5.6%.

Action 1 has failed if the 99% hot-spot count drops below 90 of 128 within five years, or if the protected proportion stays at 5.6% two years after gazettal. Action 2 has failed if the cold-spot count exceeds 14. Action 3 has failed if records with tree_cover_pct below 50 exceed 13. These thresholds come from the GeoSpaX results in this report.

## 6. Limitations

GBIF teaching extract, not a census. 128 records at 56 sites with stacked coordinates. No forest-change layer, no field-verified data. The plan is desk-based, not a field assessment. It does not include community consultation, ground-truthing, or local ecological knowledge. The habitat proxy is not a species distribution model. Hull area is not habitat area. Any move to implement the actions would require field surveys and clan consultation.

---

## References

Australian Museum. (n.d.). *Emperor Bird of Paradise*. Retrieved 15 September 2026, from https://australian.museum/about/history/exhibitions/birds-of-paradise/emperor-bird-of-paradise/

BirdLife International. (n.d.). *Emperor Bird-of-paradise Paradisaea guilielmi* [Species factsheet]. *BirdLife Data Zone*. Retrieved 15 September 2026, from https://datazone.birdlife.org/species/factsheet/emperor-bird-of-paradise-paradisaea-guilielmi

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
