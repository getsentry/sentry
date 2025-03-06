// import {Fragment, useRef, useState} from 'react';
// import styled from '@emotion/styled';

// import {Input} from 'sentry/components/core/input';
// import {Slider} from 'sentry/components/slider';
// import SizingWindow from 'sentry/components/stories/sizingWindow';
// import storyBook from 'sentry/stories/storyBook';

// import {useAutosizeInput} from 'sentry/components/core/input/growingInput';

// export default storyBook('Input', story => {
//   story('Uncontrolled', () => {
//     const ref = useAutosizeInput();
//     return (
//       <SizingWindow display="block">
//         <Input ref={ref} defaultValue="Lorem ipsum dolor sit amat" />
//       </SizingWindow>
//     );
//   });

//   story('Controlled', () => {
//     const [value, setValue] = useState('Lorem ipsum dolor sit amat');
//     const ref = useAutosizeInput({disabled: false, value});

//     return (
//       <Fragment>
//         This input is synced with the growing one:
//         <Input value={value} onChange={e => setValue(e.target.value)} />
//         <br />
//         <br />
//         <SizingWindow display="block">
//           <Input ref={ref} value={value} onChange={e => setValue(e.target.value)} />
//         </SizingWindow>
//       </Fragment>
//     );
//   });

//   story('Style with min and max width', () => {
//     const [minWidth, setMinWidth] = useState(20);
//     const [maxWidth, setMaxWidth] = useState(60);

//     return (
//       <Fragment>
//         <p>The input respects the min and max width styles.</p>
//         <SizingWindow display="block">
//           <Slider
//             label="Min width"
//             min={0}
//             max={100}
//             step={1}
//             value={minWidth}
//             onChange={value => setMinWidth(value as number)}
//           />
//           <Slider
//             label="Max width"
//             min={0}
//             max={100}
//             step={1}
//             value={maxWidth}
//             onChange={value => setMaxWidth(value as number)}
//           />
//           <br />
//           <StyledInput
//             defaultValue={'Lorem ipsum dolor sit amat'}
//             minWidth={minWidth}
//             maxWidth={maxWidth}
//             placeholder="Type something here..."
//           />
//         </SizingWindow>
//       </Fragment>
//     );
//   });
// });

// const StyledInput = styled(Input)<{maxWidth: number; minWidth: number}>`
//   min-width: ${p => p.minWidth}%;
//   max-width: ${p => p.maxWidth}%;
// `;
