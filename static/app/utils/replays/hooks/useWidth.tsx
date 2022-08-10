import {useState} from 'react';
import {useResizeObserver} from '@react-aria/utils';
import debounce from 'lodash/debounce';

const debounced = (cb: () => void) => debounce(cb, 100);

function useWidth(ref: React.RefObject<HTMLDivElement>) {
  const [width, setWidth] = useState(0);
  useResizeObserver({
    ref,
    onResize: debounced(() => {
      if (ref.current) {
        setWidth(ref.current.offsetWidth);
      }
    }),
  });
  return width;
}

export default useWidth;
