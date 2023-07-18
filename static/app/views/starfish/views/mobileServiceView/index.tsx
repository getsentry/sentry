import {ViewsList} from 'sentry/views/starfish/views/mobileServiceView/viewsList';
import {BaseStarfishViewProps} from 'sentry/views/starfish/views/webServiceView/starfishLanding';

export function MobileStarfishView(_props: BaseStarfishViewProps) {
  return (
    <div data-test-id="starfish-movile-view">
      <ViewsList />
    </div>
  );
}
