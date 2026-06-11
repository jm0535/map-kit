Five test datasets pushed. Here's exactly how to use each one to test every new tool:

---

### **Files in `samples/` — download from GitHub or drag straight into GeoSpaX**

| File | Features | Purpose |
| ----- | ----- | ----- |
| `butterfly_presences.geojson` | 40 pts | Presence layer for all 3 SDMs |
| `vine_host_plants.geojson` | 53 pts | Host plant layer — Hotspot Grid \+ WLC |
| `habitat_survey_grid.geojson` | 90 pts | Environmental variable grid — all SDMs |
| `forest_patches.geojson` | 35 pts | WLC criterion \+ constraint layer |
| `stream_water_sources.geojson` | 28 pts | Additional WLC/env layer |

---

### **Test workflow per tool**

**🔥 Conservation Hotspot Grid**

1. Load: butterflies \+ host plants \+ habitat grid  
2. Analysis → Hotspot Grid → Hex, 0.15°, Count  
3. Assign weights: butterflies=3, host plants=2, habitat=1  
4. Expected: two hot cells matching the lowland (\~146.15°E, 6.38°S) and montane (\~146.52°E, 6.81°S) colonies

**🗺 Suitability WLC**

1. Load: butterflies \+ host plants \+ forest patches  
2. Analysis → Suitability WLC → set forest patches as constraint layer  
3. Use `density` (host plants) and `count` (butterflies) as fields  
4. Expected: green patches in butterfly zones, forced to zero in high-disturbance forest patches

**🦋 Bioclim SDM**

1. Load: butterfly presences \+ habitat grid  
2. SDM → Presence \= butterflies, Env layer \= habitat grid, Field \= `elevation_m`  
3. Add second env layer \= habitat grid, Field \= `rainfall_mm`  
4. Model \= Bioclim, Resolution \= 0.08°  
5. Expected: green band at 200–600m (lowland colony) \+ 900–1400m (montane colony)

**Mahalanobis SDM**

* Same setup as Bioclim but Model \= Mahalanobis  
* Expected: elliptical suitability zones around the env centroid of presences; more gradual falloff than Bioclim

**MaxEnt (server)**

* Same setup, Model \= MaxEnt  
* Calls `/api/sdm` on Vercel — requires the live deployment to be running  
* Expected: probability surface similar to Mahalanobis but with regularised logistic-regression boundary

