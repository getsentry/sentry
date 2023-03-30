import {ReactNode, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

type Sizes = {height: number; width: number};
type ChildFn = (props: Sizes) => ReactNode;

/**
 * Similar to <AutoSizer> from 'react-virtualized` but works better with flex & grid parents
 */
const MeasureSize = styled(
  ({children, className}: {children: ChildFn; className?: string}) => {
    const outerRef = useRef<HTMLDivElement>(null);
    const [sizes, setSizes] = useState<Sizes>();
    useEffect(() => {
      if (outerRef.current) {
        const {height, width} = outerRef.current.getBoundingClientRect();
        setSizes({height, width});
      }
    }, []);

    return (
      <div ref={outerRef} className={className}>
        {sizes ? children(sizes) : null}
      </div>
    );
  }
)`
  height: 100%;
  width: 100%;
  overflow: hidden;
`;

export default MeasureSize;
