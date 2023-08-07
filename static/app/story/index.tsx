import {ComponentType, ForwardRefExoticComponent, ForwardRefRenderFunction} from 'react';

type Renderable<P> =
  | ComponentType<P>
  | ForwardRefExoticComponent<P>
  | ForwardRefRenderFunction<P>;

export default class Story<P> {
  private Component: null | Renderable<P> = null;

  constructor(public name: string) {}

  render(Component: Renderable<P>) {
    this.Component = Component;

    return this;
  }
}
