// import {ComponentType, ForwardRefExoticComponent} from 'react';

interface Props {
  component: any;
}

export default function KitchenSink({component}: Props) {
  const Comp = component;
  console.log({component});

  return (
    <div>
      <Comp />
    </div>
  );
}
