import {parseViewHierarchy} from './viewHierarchyParser';

describe('parser', () => {
  it('does the thing', () => {
    const testString = `<UIWindow: 0x7f893fc0ebd0; frame = (0 0; 375 667); gestureRecognizers = <NSArray: 0x600003478330>; layer = <UIWindowLayer: 0x600003a5a420>>
   | <UILayoutContainerView: 0x7f893fe280a0; frame = (0 0; 375 667); autoresize = W+H; gestureRecognizers = <NSArray: 0x600003440060>; layer = <CALayer: 0x600003a47760>>
   | <UIViewControllerWrapperView: 0x7f893fe32830; frame = (0 0; 375 667); autoresize = W+H; layer = <CALayer: 0x600003a4ffa0>>
   |    | <UIView: 0x7f893fe59060; frame = (-112 0; 375 667); userInteractionEnabled = NO; animations = { position=<CASpringAnimation: 0x600003a94b60>; }; layer = <CALayer: 0x600003a69500>>
   |    | <AnotherUIView: 0x7f893fe59060; frame = (-112 0; 375 667); userInteractionEnabled = NO; animations = { position=<CASpringAnimation: 0x600003a94b60>; }; layer = <CALayer: 0x600003a69500>>
   | <UIView: 0x7f893fe52222; frame = (-112 0; 375 667); userInteractionEnabled = NO; animations = { position=<CASpringAnimation: 0x600003a94b60>; }; layer = <CALayer: 0x600003a69500>>`;
    const output = parseViewHierarchy(testString);
  });
});
