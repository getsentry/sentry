import pickBy from 'lodash/pickBy';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';
import isPropValid from '@emotion/is-prop-valid';

type Props = {
  src: string;
  size?: string;
  width?: string;
  height?: string;
};

type InlineSvgProps = React.ComponentProps<'svg'> & Props;

const InlineSvg = styled(
  React.forwardRef<SVGSVGElement, InlineSvgProps>(
    // eslint-disable-next-line react/prop-types
    ({src, size, width, height, ...props}, ref) => {
      const {id, viewBox} = require(`../icons/${src}.svg`).default;

      return (
        <svg
          {...pickBy(props, (_value, key) => isPropValid(key))}
          ref={ref}
          viewBox={viewBox}
          width={width || size || '1em'}
          height={height || size || '1em'}
        >
          <use href={`#${id}`} xlinkHref={`#${id}`} />
        </svg>
      );
    }
  )
)`
  vertical-align: middle;
`;

InlineSvg.propTypes = {
  src: PropTypes.string.isRequired,
  size: PropTypes.string,
  width: PropTypes.string,
  height: PropTypes.string,
};

export default InlineSvg;
