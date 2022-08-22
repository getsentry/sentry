import { useLayoutEffect, useState } from "react";
import * as SCROLL from "../constants/scrolldirection";

export const useScrollDirection = () => {
  const [scrollDirection, setScrollDirection] = useState(SCROLL.INITIAL);

  useLayoutEffect(() => {
    let prevScrollY = window.pageYOffset;

    const onScroll = () => {
      const scrollY = window.pageYOffset;
      if (scrollY === 0) {
        setScrollDirection(SCROLL.INITIAL);
      } else {
        setScrollDirection(scrollY > prevScrollY ? SCROLL.DOWN : SCROLL.UP);
      }
      prevScrollY = scrollY;
    };

    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return scrollDirection;
};
