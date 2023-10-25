import React, { useEffect, useState, useCallback } from 'react';
import {createRoot} from 'react-dom/client';

import DeckGL from '@deck.gl/react';
import {MapView} from '@deck.gl/core';
import {TileLayer} from '@deck.gl/geo-layers';
import {BitmapLayer, PathLayer} from '@deck.gl/layers';

import TripBuilder from './trip-builder'
// import { updateLanguageServiceSourceFile } from 'typescript';
import { ScenegraphLayer } from '@deck.gl/mesh-layers';
import { Deck, FlyToInterpolator } from '@deck.gl/core';

// const DATA_URL = 'data/trips_recs2.json';
const DATA_URL = 'data/trips_time.json';

// Define the attributes of the layer for each model.
// Different gltf modeld have different sizes, orientations, etc.
//
const MODELS = new Map([
  ['airplane', {
    url: 'data/airplane.glb',
    sizeMinPixels: 1,
    sizeMaxPixels: 60,
    orientation: d => [0, -d.heading, 90+d.pitch]
  }],
  ['box', {
    url: 'data/BoxAnimated.glb',
    sizeMinPixels: 20,
    sizeMaxPixels: 60,
    orientation: d => [0, 180-d.heading, 90+d.pitch],
  }],
  ['cesiumman', {
    url:'data/CesiumMan.glb',
    sizeMinPixels: 40,
    sizeMaxPixels: 50,
    orientation: d => [0, 180-d.heading, 90+d.pitch],
  }],
  ['duck', {
    url:'data/Duck.glb',
    sizeMinPixels: 30,
    sizeMaxPixels: 60,
    orientation: d => [0, 90-d.heading, 90+d.pitch],
  }],
  ['truck', {
    url: 'data/truck.gltf',
    sizeMinPixels: 10,
    sizeMaxPixels: 60,
    orientation: d => [0, 180-d.heading, 90+d.pitch]
  }]
]);

const ANIMATIONS = {
  '0': {speed: 5}
};

// Start at a generic high point; zoom in when we get the data
// and figure out the bounding box.
//
const INITIAL_VIEW_STATE = {
  latitude: 0,
  longitude: 0,
  zoom: 0,
  pitch: 45,
  maxZoom: 20,
  maxPitch: 89,
  bearing: 0
};

const COPYRIGHT_LICENSE_STYLE = {
  position: 'absolute',
  right: 0,
  bottom: 0,
  backgroundColor: 'hsla(0,0%,100%,.5)',
  padding: '0 5px',
  font: '12px/20px Helvetica Neue,Arial,Helvetica,sans-serif'
};

const LINK_STYLE = {
  textDecoration: 'none',
  color: 'rgba(0,0,0,.75)',
  cursor: 'grab'
};

/* global window */
const devicePixelRatio = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;

async function getTripData(url) {
  const resp = await fetch(url);
  const data = await resp.json();

  return data;
}

export function App() {
  const [pathData, setPathData] = useState(null); // Original data (mild munging).
  // const [tripData, setTripData] = useState(null); // Rebuilt trip data.
  const [frameData, setFrameData] = useState([]); // Just the data for the current timestamp.
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE); // Bounding box.
  const tileOptions = {
    showBorder: false,
    onTilesLoad: null,
    onDataLoad: null//() => {console.log('DATA LOADED')}
  };

  // console.log('@@ RENDER');
  useEffect(() => {
    console.log('********* USEEFFECT ********');
    fetch(DATA_URL)
      .then(r => r.json())
      .then(r => {
        console.log(`FETCHED ${r.length} ${JSON.stringify(r)} / ${JSON.stringify(r[0])}`);
        console.log(`R ${JSON.stringify(r)}`);
        setPathData(r);

        const trips = r.map(waypoints => new TripBuilder({waypoints, loop: true}));

        const minx = Math.min(...trips.map(trip => trip.minx));
        const miny = Math.min(...trips.map(trip => trip.miny));
        const maxx = Math.max(...trips.map(trip => trip.maxx));
        const maxy = Math.max(...trips.map(trip => trip.maxy));
        setViewState({
            longitude: (minx+maxx)/2,
            latitude: (miny+maxy)/2,
            zoom: 8,
            pitch: 45,
            maxZoom: 20,
            maxPitch: 89,
            bearing: 0,
            transitionDuration: 2000,
            transitionInterpolator: new FlyToInterpolator()
        });
        console.log(`BBOX ${minx},${miny} ${maxx},${maxy}`);

        // setTripData(trips);
        startAnimation(trips);//(r);
        console.log('@@ START');
      })},
    []
  );

  const pathLayer = //pathData &&
    new PathLayer({
      id: 'path-lines',
      data: pathData,
      getPath: d => {const d2 = d.coords.map(c => [c[0],c[1],c[2]+0.25]); d2.push(d2[0]); return d2;}, // Join the ends; Lift above the map (by width/2 ?  or something else?).
      pickable: false,
      getColor: d => d.color,
      billboard: true,
      jointRounded: true,
      opacity: 1.0,
      getWidth: 270
    });

    const models = [...new Set(frameData.map(e => e.model))];

    const layers = models.map(model => new ScenegraphLayer({
      id: `${model}-layer`,
      data: frameData.filter(e => e.model==model),
      pickable: true,
      scenegraph: MODELS.get(model).url,
      _animations: ANIMATIONS,
      sizeMinPixels: MODELS.get(model).sizeMinPixels,
      sizeMaxPixels: MODELS.get(model).sizeMaxPixels,
      getPosition: d => d.point,
      getTranslation: d => [0, 0, 5], // Lift above map
      getOrientation: MODELS.get(model).orientation, //d => [0, 180-d.heading, 90+d.pitch],
      sizeScale: 1,
      // getColor: d => d.color,
      _lighting: 'pbr' // 'flat' | 'pbr'
    }));

    const tileLayer = new TileLayer({
    // https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames#Tile_servers
    data: [
      'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
      'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
      'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
    ],

    // Since these OSM tiles support HTTP/2, we can make many concurrent requests
    // and we aren't limited by the browser to a certain number per domain.
    maxRequests: 20,

    pickable: false,
    onViewportLoad: tileOptions.onTilesLoad,
    autoHighlight: tileOptions.showBorder,
    // highlightColor: [60, 60, 60, 40],
    // https://wiki.openstreetmap.org/wiki/Zoom_levels
    minZoom: 0,
    maxZoom: 19,
    tileSize: 256,
    zoomOffset: devicePixelRatio === 1 ? -1 : 0,
    renderSubLayers: props => {
      const {
        bbox: {west, south, east, north}
      } = props.tile;

      return [
        new BitmapLayer(props, {
          data: null,
          image: props.data,
          bounds: [west, south, east, north],
          desaturate: 0.75,
          tintColor: [127, 127, 127]
        }),
        // tileOptions.showBorder &&
        //   new PathLayer({
        //     id: `${props.id}-border`,
        //     data: [
        //       [
        //         [west, north],
        //         [west, south],
        //         [east, south],
        //         [east, north],
        //         [west, north]
        //       ]
        //     ],
        //     getPath: d => d,
        //     getColor: [127, 127, 127],
        //     widthMinPixels: 4
        //   })
      ];
    }
  });

  const startAnimation = (tripData) => {
    const trips = tripData;
    console.log(`@@ TRIPS ${JSON.stringify(trips)}`);

    let timestamp = 0;

    let frameNum = 0;
    let animation = null;

    const onAnimationFrame = () => {
      // timestamp += 0.02;
      timestamp += 0.04;
      const frame = trips.map(trip => trip.getFrame(timestamp));
      setFrameData(frame);
      // console.log(`@@ FRAME ${timestamp} ${JSON.stringify(frame)}`);

      frameNum = frameNum+1;
      // const thisFrame = tripData.map(d => ({name:d.name, coords:d.coords[Math.floor(frameNum/100)%4], color:d.color}));
      // setFrameData(thisFrame);

      const keepGoing = true;//frameNum<1000;
      animation = keepGoing ? requestAnimationFrame(onAnimationFrame) : null;
    };

    onAnimationFrame();
  };

  const getTooltip = (info) => {
    // https://deck.gl/docs/developer-guide/interactivity#the-picking-info-object
    // We can do styles here.

    if (info.layer==null || info.index==-1) {
      return null;
    }

    return {
      html: `${info.object.name}<br>${info.coordinate}<br><img src="flags/${info.object.flag}.png">`
    }
  };

  return (
    <DeckGL
      layers={layers.concat(pathLayer, tileLayer)}
      views={new MapView({repeat: true})}
      viewState={viewState}
      onViewStateChange={e => setViewState(e.viewState)}
      controller={true}
      getTooltip={getTooltip}
    >
      <div style={COPYRIGHT_LICENSE_STYLE}>
        {'© '}
        <a style={LINK_STYLE} href="http://www.openstreetmap.org/copyright" target="blank">
          OpenStreetMap contributors
        </a>
      </div>
    </DeckGL>
  );
}

export function renderToDOM(
  container,
  options = {
    tracking: true,
    showPaths: true
  }
) {
  createRoot(container).render(<App/>);
}
