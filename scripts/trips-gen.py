#!/usr/bin/env python3

# Start with the original data.
# - add names
# - add altitude
# - add another path

import json
import math
import colorcet as cc

C = {
    'China': 'cn',
    'Australia': 'au',
    'United States': 'us',
    'New Zealand': 'nz',
    'UK': 'gb',
    'Canada': 'ca',
    'Russia': 'ru'
}
CNAMES = list(C.keys())

class Color:
    def __init__(self):
        self.pal = cc.glasbey_bw_minc_20_minl_30
        self.ix = 0

    def color(self):
        c = [i*255 for i in self.pal[self.ix]] + [192]
        print(self.ix, c)
        self.ix += 1
        return c

color = Color()

def main(inpath, outpath):
    with open(inpath) as f:
        trips = json.load(f)

    print(len(trips))

    minx, miny, maxx, maxy = 180, 90, -180, -90
    new_trips = []

    for i, trip in enumerate(trips):
        locs = [[x,y,i*40] for d,(x,y) in enumerate(trip)]
        name = CNAMES[i]
        new_trip = {
            'name': name,
            'flag': C[name],
            'coords': locs,
            'color': color.color(),
            'model': 'duck' if i==4 else 'truck' if i>1 else 'cesiumman' if i>0 else 'box'
        }
        new_trips.append(new_trip)

        nx = min(x for x,y in trip)
        ny = min(y for x,y in trip)
        xx = max(x for x,y in trip)
        xy = max(y for x,y in trip)
        minx = min(minx, nx)
        miny = min(miny, ny)
        maxx = max(maxx, xx)
        maxy = max(maxy, xy)

    print(minx, miny, maxx, maxy)
    xc, yc = minx+(maxx-minx)/2, miny+(maxy-miny)/2

    new_trip = {
        'name': 'Ukraine',
        'flag': 'ua',
        'coords': [
            [xc+0.005*math.cos(math.radians(i)), yc+0.005*math.sin(math.radians(i)), i+90] for i in range(270, -90, -1)
        ],
        'color': color.color(),
        'model': 'airplane'
    }
    new_trips.append(new_trip)

    new_trip = {
        'name': 'Japan',
        'flag': 'jp',
        'coords': [
            [xc+0.006*math.cos(math.radians(i)), yc+0.007*math.sin(math.radians(i)), i+360] for i in range(-90, 270, 72)
        ],
        'color': color.color(),
        'model': 'airplane'
    }
    new_trips.append(new_trip)

    with open(outpath, 'w') as f:
        json.dump(new_trips, f, indent=2)

if __name__=='__main__':
    main('data/trips.json', 'data/trips_recs2.json')
