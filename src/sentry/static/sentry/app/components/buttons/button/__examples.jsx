/*eslint react/jsx-key:0*/
import React from 'react';
import Button from './index';

export default [
  <Button priority="primary" size="lg" to="/sup">Click it</Button>,
  <Button
    onClick={() => {
      alert('hiya');
    }}>
    Click it
  </Button>,
  <Button
    priority="danger"
    size="sm"
    onClick={() => {
      alert('💥');
    }}>
    Click it
  </Button>,
  <Button size="xs" href="http://example.com">Click it</Button>,
  <Button
    disabled
    size="xs"
    onClick={() => {
      alert('💥');
    }}>
    Don't click it!
  </Button>
];
