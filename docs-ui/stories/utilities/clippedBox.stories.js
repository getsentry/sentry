import ClippedBox from 'sentry/components/clippedBox';

export default {
  title: 'Utilities/Hidden Content/Clipped Box',
  component: ClippedBox,
  args: {
    title: 'Clipped Box Title',
    clipHeight: 60,
    btnText: 'expand',
    defaultClipped: true,
  },
  argTypes: {
    onReveal: {action: 'onReveal'},
  },
};

export const Default = ({...args}) => (
  <div>
    <div>
      <ClippedBox {...args}>
        Tilde taiyaki lumbersexual, franzen gochujang forage mixtape meditation mumblecore
        af food truck etsy butcher. Post-ironic taiyaki affogato, artisan biodiesel
        kickstarter direct trade try-hard tacos subway tile swag vice trust fund shaman
        whatever. Everyday carry cliche lomo, bicycle rights vaporware tbh meditation
        occupy bespoke. Meh green juice enamel pin thundercats, aesthetic intelligentsia
        hoodie fanny pack venmo. Kale chips tacos activated charcoal pinterest tousled
        hoodie 8-bit occupy distillery. Tote bag godard thundercats small batch banjo, DIY
        waistcoat. Glossier poutine VHS put a bird on it listicle deep v letterpress. Tbh
        banjo paleo cred hoodie. Live-edge synth twee, subway tile coloring book woke swag
        XOXO cornhole glossier neutra hell of lo-fi brooklyn actually. Retro beard
        jianbing, shoreditch kitsch banh mi flexitarian mustache cold-pressed. Sriracha af
        brooklyn, poutine snackwave taxidermy ugh locavore mlkshk shaman before they sold
        out +1. Microdosing copper mug edison bulb, synth tote bag man braid heirloom.
        Cray tattooed portland, echo park sustainable gluten-free chartreuse hexagon.
        Pitchfork fixie keffiyeh mustache +1 vinyl, cliche pok pok vegan hashtag live-edge
        williamsburg wayfarers butcher beard.
      </ClippedBox>
    </div>
  </div>
);

Default.storyName = 'Clipped Box';
Default.parameters = {
  docs: {
    description: {
      story: 'Component that clips content and allows expansion of container',
    },
  },
};

export const ClipFlex = () => (
  <div>
    <div>
      With clipFlex off, show more is hardly hiding anything
      <ClippedBox clipHeight={100} clipFlex={0}>
        <div style={{backgroundColor: 'SeaGreen', height: '80px'}} />
      </ClippedBox>
      With clipFlex on (component should be expanded)
      <ClippedBox clipHeight={100}>
        <div style={{backgroundColor: 'SeaGreen', height: '80px'}} />
      </ClippedBox>
    </div>
  </div>
);

ClipFlex.storyName = 'Clipped Box Flex';
ClipFlex.parameters = {
  docs: {
    description: {
      story: 'Demo showing a component that is only slightly larger than the clipHeight',
    },
  },
};
