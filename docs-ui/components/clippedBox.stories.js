import {withInfo} from '@storybook/addon-info';
// import {action} from '@storybook/addon-actions';

import ClippedBox from 'app/components/clippedBox';

export default {
  title: 'UI/ClippedBox',
};

export const Default = withInfo(
  'Component that clips content and allows expansion of container'
)(() => (
  <div>
    <div>
      <ClippedBox
        defaultClipped
        title="Clipped Box Title"
        clipHeight={60}
        btnText="Expand"
      >
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
));

Default.story = {
  name: 'default',
};
