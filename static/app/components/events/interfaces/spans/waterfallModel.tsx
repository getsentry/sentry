import isEqual from 'lodash/isEqual';
import {action, computed, makeObservable, observable} from 'mobx';

import {EventTransaction} from 'app/types/event';

import {ActiveOperationFilter, noFilter, toggleAllFilters, toggleFilter} from './filter';
import SpanTreeModel from './spanTreeModel';
import {ParsedTraceType} from './types';
import {generateRootSpan, parseTrace} from './utils';

class WaterfallModel {
  // readonly state
  event: Readonly<EventTransaction>;
  rootSpan: SpanTreeModel;
  parsedTrace: ParsedTraceType;

  // readable/writable state
  operationNameFilters: ActiveOperationFilter = noFilter;

  constructor(event: Readonly<EventTransaction>) {
    this.event = event;

    this.parsedTrace = parseTrace(event);
    const rootSpan = generateRootSpan(this.parsedTrace);
    this.rootSpan = new SpanTreeModel(rootSpan, this.parsedTrace.childSpans);

    makeObservable(this, {
      rootSpan: observable,

      // operation names filtering
      operationNameFilters: observable,
      toggleOperationNameFilter: action,
      toggleAllOperationNameFilters: action,
      operationNameCounts: computed.struct,
    });
  }

  isEvent(otherEvent: Readonly<EventTransaction>) {
    return isEqual(this.event, otherEvent);
  }

  toggleOperationNameFilter = (operationName: string) => {
    this.operationNameFilters = toggleFilter(this.operationNameFilters, operationName);
  };

  toggleAllOperationNameFilters = () => {
    const operationNames = Array.from(this.operationNameCounts.keys());

    this.operationNameFilters = toggleAllFilters(
      this.operationNameFilters,
      operationNames
    );
  };

  get operationNameCounts(): Map<string, number> {
    return this.rootSpan.operationNameCounts;
  }
}

export default WaterfallModel;
