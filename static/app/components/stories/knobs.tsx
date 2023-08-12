// import {ComponentType, ForwardRefExoticComponent} from 'react';

interface Props {
  component: any;
}

export default function Knobs({component}: Props) {
  const Comp = component;
  console.log({component});

  return (
    <div>
      <Comp />
    </div>
  );
}
