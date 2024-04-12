// These are the icons used in the TraceDetails component - their SVGs path values have been copied
// and removed from the emotion wrapper which is parsing and compiling unnecessary CSS as the
// components rerended, which causes frame drops and performance issues that result in white
// row flashes when scrolling.
function Chevron(props: {direction: 'up' | 'down' | 'left'}) {
  return (
    <svg
      viewBox="0 0 16 16"
      style={{
        transform: `rotate(${props.direction === 'up' ? 0 : props.direction === 'down' ? 180 : -90}deg)`,
      }}
    >
      <path d="M14,11.75a.74.74,0,0,1-.53-.22L8,6.06,2.53,11.53a.75.75,0,0,1-1.06-1.06l6-6a.75.75,0,0,1,1.06,0l6,6a.75.75,0,0,1,0,1.06A.74.74,0,0,1,14,11.75Z" />
    </svg>
  );
}

function Fire() {
  return (
    <svg viewBox="0 0 16 16">
      <path d="M8.08,15.92A6.58,6.58,0,0,1,1.51,9.34a4.88,4.88,0,0,1,2.2-4.25.74.74,0,0,1,1,.34,6,6,0,0,1,4-5.3A.74.74,0,0,1,9.4.22a.73.73,0,0,1,.33.61v.31A15.07,15.07,0,0,0,10,4.93a3.72,3.72,0,0,1,2.3-1.7.74.74,0,0,1,.66.12.75.75,0,0,1,.3.6A6.21,6.21,0,0,0,14,6.79a5.78,5.78,0,0,1,.68,2.55A6.58,6.58,0,0,1,8.08,15.92ZM3.59,7.23A4.25,4.25,0,0,0,3,9.34a5.07,5.07,0,1,0,10.14,0,4.6,4.6,0,0,0-.54-1.94,8,8,0,0,1-.76-2.32A2,2,0,0,0,11.07,7a.75.75,0,0,1-1.32.58C8.4,6,8.25,4.22,8.23,2c-2,1.29-2.15,3.58-2.09,5.85A7.52,7.52,0,0,1,6.14,9a.74.74,0,0,1-.46.63.77.77,0,0,1-.76-.11A4.56,4.56,0,0,1,3.59,7.23Z" />
    </svg>
  );
}

function Profile() {
  return (
    <svg viewBox="0 0 20 16">
      <path d="M15.25,0H.75C.33,0,0,.34,0,.75V5.59c0,.41,.34,.75,.75,.75h1.49v4.09c0,.41,.34,.75,.75,.75h1.73v4.09c0,.41,.34,.75,.75,.75h5.06c.41,0,.75-.34,.75-.75v-4.09h1.73c.41,0,.75-.34,.75-.75V6.34h1.49c.41,0,.75-.34,.75-.75V.75c0-.41-.34-.75-.75-.75Zm-5.47,14.52h-3.56v-3.34h3.56v3.34Zm2.48-4.84H3.74v-3.34H12.25v3.34Zm2.24-4.84H1.5V1.5H14.5v3.34Z" />
    </svg>
  );
}
export const TraceIcons = {
  Chevron,
  Fire,
  Profile,
};
