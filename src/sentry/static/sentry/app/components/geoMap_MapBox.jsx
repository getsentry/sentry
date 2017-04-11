import React from 'react';
import mapboxgl from 'mapbox-gl';

mapboxgl.accessToken = 'pk.eyJ1IjoiZGNyYW1lciIsImEiOiJjajFjb2kwaXMwMDV3MndwZHoydWpuOW8zIn0.l8WEL9_ms76IC69tC9Wp4g';

export default React.createClass({
  propTypes: {
    series: React.PropTypes.arrayOf(React.PropTypes.shape({
      lng: React.PropTypes.number.isRequired,
      lat: React.PropTypes.number.isRequired,
    })).isRequired,
    height: React.PropTypes.number,
    defaultZoom: React.PropTypes.number,
  },

  getDefaultProps() {
    return {
      height: 600,
      defaultZoom: 1,
    };
  },

  componentDidMount() {
    this.map = new mapboxgl.Map({
      container: this.refs.map,
      style: 'mapbox://styles/mapbox/light-v9',
      maxZoom: 14,
      zoom: this.props.defaultZoom,
      renderWorldCopies: false,
      interactive: false,
    });
    this.map.on('load', () => {
      this.map.addSource('locations', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: this.props.series.map((p) => {
            return {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [p.lng, p.lat],
              },
              properties: {
                'Primary ID': `${p.city}, ${p.region} ${p.country}`,
              },
            };
          }),
        },
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });
      this.map.addLayer({
        id: 'points',
        type: 'symbol',
        source: 'locations',
        filter: ['!has', 'point_count'],
        layout: {
          'icon-image': 'marker-15',
        },
      });
      // Display the earthquake data in three layers, each filtered to a range of
      // count values. Each range gets a different fill color.
      let layers = [
        [150, '#f28cb1'],
        [20, '#f1f075'],
        [0, '#51bbd6']
      ];

      layers.forEach((layer, i) => {
        this.map.addLayer({
          id: 'points-' + i,
          type: 'circle',
          source: 'locations',
          paint: {
            'circle-color': layer[1],
            'circle-radius': 18,
          },
          filter: i === 0 ?
            ['>=', 'point_count', layer[0]] :
            ['all',
              ['>=', 'point_count', layer[0]],
              ['<', 'point_count', layers[i - 1][0]]]
        });
      });

      // Add a layer for the clusters' count labels
      this.map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'locations',
        layout: {
          'text-field': '{point_count}',
          'text-font': [
            'DIN Offc Pro Medium',
            'Arial Unicode MS Bold',
          ],
          'text-size': 12,
        },
      });
    });

    this._resizeListener = window.addEventListener('resize', () => {
      this.map.resize();
    });
  },

  componentWillUnmount() {
    window.removeEventListener('resize', this._resizeListener);
    this.map.remove();
  },

  render() {
    return (
      <div className="map-container" style={{height: this.props.height}} ref="map" />
    );
  }
});
