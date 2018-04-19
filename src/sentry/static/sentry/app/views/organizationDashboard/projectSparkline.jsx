import PropTypes from 'prop-types';
import React from 'react';
import {Sparklines, SparklinesLine} from 'react-sparklines';

export default function ProjectSparkline(props) {
  let values = props.data.map(tuple => tuple[1]);

  return (
    <Sparklines data={values} width={100} height={32}>
      <SparklinesLine
        {...props}
        style={{stroke: '#8f85d4', fill: 'none', strokeWidth: 3}}
      />
    </Sparklines>
  );
}
ProjectSparkline.propTypes = {
  data: PropTypes.array.isRequired,
};
