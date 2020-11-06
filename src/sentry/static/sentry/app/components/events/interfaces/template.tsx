import React from 'react';

import EventDataSection from 'app/components/events/eventDataSection';
import Line from 'app/components/events/interfaces/frame/line';
import {t} from 'app/locale';
import {Frame, Event} from 'app/types';

type Props = {
  type: string;
  data: Frame;
  event: Event;
};

const TemplateInterface = ({type, data, event}: Props) => (
  <EventDataSection type={type} title={t('Template')}>
    <div className="traceback no-exception">
      <ul>
        <Line data={data} event={event} registers={{}} components={[]} isExpanded />
      </ul>
    </div>
  </EventDataSection>
);
export default TemplateInterface;
