export const animations = {
  moveOver: {
    initial: {x: 100, opacity: 0},
    animate: {x: 0, opacity: 1},
    exit: {x: 100, opacity: 0},
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30,
      mass: 0.8,
    },
  },
} as const;
