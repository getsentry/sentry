export const cronMetrics = {
  title: 'Cron Metrics',
  description: '',
  widgets: [
    {
      id: 2580669976488004,
      definition: {
        title: '[Consumer] Check-Ins Health',
        background_color: 'blue',
        show_title: true,
        type: 'group',
        layout_type: 'ordered',
        widgets: [
          {
            id: 3740315402180984,
            definition: {
              title: 'Monitor consumer ingest results',
              title_size: '16',
              title_align: 'left',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [{formula: 'query4'}],
                  queries: [
                    {
                      name: 'query4',
                      data_source: 'metrics',
                      query:
                        'sum:sentry.monitors.checkin.result{source:consumer, $sentry_region} by {status,sentry_region}.as_rate()',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {palette: 'semantic', line_type: 'solid', line_width: 'normal'},
                  display_type: 'area',
                },
              ],
            },
            layout: {x: 0, y: 0, width: 12, height: 2},
          },
          {
            id: 786215572899230,
            definition: {
              title: 'Consumer checkins by result',
              title_size: '16',
              title_align: 'left',
              show_legend: false,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [{formula: 'query1'}],
                  queries: [
                    {
                      name: 'query1',
                      data_source: 'metrics',
                      query:
                        'sum:sentry.monitors.checkin.result{source:consumer} by {status}.as_count()',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {palette: 'semantic', line_type: 'solid', line_width: 'normal'},
                  display_type: 'bars',
                },
              ],
            },
            layout: {x: 0, y: 2, width: 6, height: 3},
          },
          {
            id: 2709313665514468,
            definition: {
              title: 'Monitor consumer ingest results anomalies',
              title_size: '16',
              title_align: 'left',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [
                    {alias: 'Completed', formula: "anomalies(query1, 'agile', 2)"},
                    {
                      alias: 'Failed validation',
                      formula: "anomalies(query2, 'agile', 3)",
                    },
                    {alias: 'Error', formula: "anomalies(query3, 'basic', 3)"},
                  ],
                  queries: [
                    {
                      name: 'query1',
                      data_source: 'metrics',
                      query:
                        'sum:sentry.monitors.checkin.result{source:consumer,status:complete}.as_count()',
                    },
                    {
                      name: 'query2',
                      data_source: 'metrics',
                      query:
                        'sum:sentry.monitors.checkin.result{source:consumer,status:failed_validation}.as_count()',
                    },
                    {
                      name: 'query3',
                      data_source: 'metrics',
                      query:
                        'sum:sentry.monitors.checkin.result{source:consumer,status:error*}.as_count()',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {palette: 'cool', line_type: 'solid', line_width: 'normal'},
                  display_type: 'area',
                },
              ],
            },
            layout: {x: 6, y: 2, width: 6, height: 3},
          },
          {
            id: 7683148692663222,
            definition: {
              title: 'Consumer checkins by SDK platform',
              title_size: '16',
              title_align: 'left',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [{formula: 'query1'}],
                  queries: [
                    {
                      name: 'query1',
                      data_source: 'metrics',
                      query:
                        'sum:sentry.monitors.checkin.result{*} by {sdk_platform}.as_count()',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'bars',
                },
              ],
            },
            layout: {x: 0, y: 5, width: 6, height: 3},
          },
          {
            id: 3152850746446550,
            definition: {
              title: 'Consumer checkins by platform trendlines',
              title_size: '16',
              title_align: 'left',
              show_legend: true,
              legend_layout: 'horizontal',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [
                    {alias: 'Next.JS', formula: 'trend_line(query2)'},
                    {alias: 'Python', formula: 'trend_line(query1)'},
                    {alias: 'PHP', formula: 'trend_line(query3)'},
                    {alias: 'Laravel', formula: 'trend_line(query4)'},
                    {alias: 'Node', formula: 'trend_line(query5)'},
                    {alias: 'API', formula: 'trend_line(query6)'},
                  ],
                  queries: [
                    {
                      name: 'query2',
                      data_source: 'metrics',
                      query:
                        'sum:sentry.monitors.checkin.result{sdk_platform:sentry.javascript.nextjs*}.as_count()',
                    },
                    {
                      name: 'query1',
                      data_source: 'metrics',
                      query:
                        'sum:sentry.monitors.checkin.result{sdk_platform:sentry.python*}.as_count()',
                    },
                    {
                      name: 'query3',
                      data_source: 'metrics',
                      query:
                        'sum:sentry.monitors.checkin.result{sdk_platform:sentry.php*}.as_count()',
                    },
                    {
                      name: 'query4',
                      data_source: 'metrics',
                      query:
                        'sum:sentry.monitors.checkin.result{sdk_platform:sentry.php.laravel*}.as_count()',
                    },
                    {
                      name: 'query5',
                      data_source: 'metrics',
                      query:
                        'sum:sentry.monitors.checkin.result{sdk_platform:sentry.javascript.node*}.as_count()',
                    },
                    {
                      name: 'query6',
                      data_source: 'metrics',
                      query:
                        'sum:sentry.view.response{instance:sentry.monitors.endpoints.monitor_ingest_*,method:post}.as_count()',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'line',
                },
              ],
              markers: [],
            },
            layout: {x: 6, y: 5, width: 6, height: 3},
          },
          {
            id: 8418573694278902,
            definition: {
              title: 'Failed Validation by platform',
              title_size: '16',
              title_align: 'left',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [{formula: 'query1'}],
                  queries: [
                    {
                      name: 'query1',
                      data_source: 'metrics',
                      query:
                        'sum:sentry.monitors.checkin.result{status:failed_validation} by {sdk_platform}.as_count()',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'bars',
                },
              ],
            },
            layout: {x: 0, y: 8, width: 6, height: 2},
          },
          {
            id: 7775407061905300,
            definition: {
              title: 'Time spent from Relay → Kafka (slow means checkins will miss)',
              title_size: '16',
              title_align: 'left',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [{formula: 'query1'}],
                  queries: [
                    {
                      name: 'query1',
                      data_source: 'metrics',
                      query: 'avg:sentry.monitors.checkin.relay_kafka_delay{*}',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'bars',
                },
              ],
            },
            layout: {x: 6, y: 8, width: 6, height: 2},
          },
          {
            id: 196324520490126,
            definition: {
              title: 'Time to process (read from Kafka → Consumer done)',
              title_size: '16',
              title_align: 'left',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [
                    {
                      formula: 'query1',
                      number_format: {
                        unit: {type: 'canonical_unit', unit_name: 'second'},
                      },
                    },
                  ],
                  queries: [
                    {
                      name: 'query1',
                      data_source: 'metrics',
                      query: 'avg:sentry.monitors.checkin.completion_time{*}',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'bars',
                },
              ],
            },
            layout: {x: 6, y: 10, width: 6, height: 2},
          },
        ],
      },
      layout: {x: 0, y: 0, width: 12, height: 13},
    },
    {
      id: 3867454200583064,
      definition: {
        title: 'Kafka',
        show_title: true,
        type: 'group',
        layout_type: 'ordered',
        widgets: [
          {
            id: 4354345389598268,
            definition: {
              title: 'ingest-monitors kafka topic lag',
              title_size: '16',
              title_align: 'left',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [{formula: 'query1'}],
                  queries: [
                    {
                      name: 'query1',
                      data_source: 'metrics',
                      query: 'sum:kafka.consumer_lag{topic:ingest-monitors}',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'area',
                },
                {
                  on_right_yaxis: false,
                  formulas: [
                    {alias: 'Anomalies', formula: "anomalies(query0, 'basic', 5)"},
                  ],
                  queries: [
                    {
                      data_source: 'metrics',
                      name: 'query0',
                      query: 'sum:kafka.consumer_lag{topic:ingest-monitors}',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'line',
                },
              ],
            },
            layout: {x: 0, y: 0, width: 4, height: 2},
          },
          {
            id: 4939368077142108,
            definition: {
              title: '',
              title_size: '16',
              title_align: 'left',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [{formula: 'autosmooth(query1)'}],
                  queries: [
                    {
                      name: 'query1',
                      data_source: 'metrics',
                      query: 'avg:kafka.topic.messages_in.rate{topic:ingest-monitors}',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'area',
                },
              ],
            },
            layout: {x: 4, y: 0, width: 4, height: 2},
          },
          {
            id: 4800977148147096,
            definition: {
              title:
                'Consumer time breakdown (unitless! those are summed up durations, flushed every second or so)',
              title_size: '16',
              title_align: 'left',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [
                    {alias: 'poll', formula: 'query1'},
                    {alias: 'processing', formula: 'query2'},
                  ],
                  queries: [
                    {
                      name: 'query1',
                      data_source: 'metrics',
                      query:
                        'sum:sentry.consumer.arroyo.consumer.poll.time.avg{consumer_group:ingest-monitors-consumers-0, sentry_region:us}.rollup(sum)',
                    },
                    {
                      name: 'query2',
                      data_source: 'metrics',
                      query:
                        'sum:sentry.consumer.arroyo.consumer.processing.time.avg{consumer_group:ingest-monitors-consumers-0, sentry_region:us}.rollup(sum)',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'area',
                },
              ],
            },
            layout: {x: 8, y: 0, width: 4, height: 2},
          },
        ],
      },
      layout: {x: 0, y: 13, width: 12, height: 3},
    },
    {
      id: 6944226016789860,
      definition: {
        title: '[API] Check-ins Health',
        background_color: 'blue',
        show_title: true,
        type: 'group',
        layout_type: 'ordered',
        widgets: [
          {
            id: 5784975779169620,
            definition: {
              title: 'Check-ins by HTTP Responses',
              title_size: '16',
              title_align: 'left',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [{style: {palette: 'cool'}, formula: 'query1'}],
                  queries: [
                    {
                      name: 'query1',
                      data_source: 'metrics',
                      query:
                        'sum:sentry.view.response{instance:sentry.monitors.endpoints.monitor_ingest_* AND method:post OR method:put} by {status_code}.as_rate()',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'area',
                },
              ],
            },
            layout: {x: 0, y: 0, width: 6, height: 3},
          },
          {
            id: 8018897826274896,
            definition: {
              title: 'Check-ins Responses',
              title_size: '16',
              title_align: 'left',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [{style: {palette: 'cool'}, formula: 'query1'}],
                  queries: [
                    {
                      name: 'query1',
                      data_source: 'metrics',
                      query:
                        'sum:sentry.view.response{instance:sentry.monitors.endpoints.monitor_ingest_*,method:post} by {status_code}.as_count()',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'bars',
                },
              ],
            },
            layout: {x: 6, y: 0, width: 6, height: 3},
          },
          {
            id: 4487736615605596,
            definition: {
              title: 'Check-ins by response time',
              title_size: '16',
              title_align: 'left',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [{alias: 'Response Time', formula: 'query1'}],
                  queries: [
                    {
                      name: 'query1',
                      data_source: 'metrics',
                      query:
                        'avg:sentry.view.duration.avg{instance:sentry.monitors.endpoints.monitor_ingest_*} by {instance}',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'area',
                },
              ],
            },
            layout: {x: 0, y: 3, width: 6, height: 3},
          },
          {
            id: 282796396844216,
            definition: {
              title: 'Check-ins HTTP 200s vs non-200s Responses',
              title_size: '16',
              title_align: 'left',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [
                    {alias: '200s', formula: 'query1'},
                    {alias: 'Non-200s', formula: 'query2'},
                    {alias: 'Rate limiter dropped', formula: 'query3'},
                  ],
                  queries: [
                    {
                      name: 'query1',
                      data_source: 'metrics',
                      query:
                        'sum:sentry.view.response{instance:sentry.monitors.endpoints.monitor_ingest_* AND status_code:20* AND (method:post OR method:put)}.as_count()',
                    },
                    {
                      name: 'query2',
                      data_source: 'metrics',
                      query:
                        'sum:sentry.view.response{instance:sentry.monitors.endpoints.monitor_ingest_* AND NOT status_code:20* AND (method:post OR method:put)}.as_count()',
                    },
                    {
                      name: 'query3',
                      data_source: 'metrics',
                      query:
                        'sum:sentry.monitors.checkin.dropped.ratelimited{source:api}.as_count()',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {palette: 'cool', line_type: 'solid', line_width: 'normal'},
                  display_type: 'area',
                },
              ],
              markers: [],
            },
            layout: {x: 6, y: 3, width: 6, height: 3},
          },
          {
            id: 58300858061474,
            definition: {
              title: 'Total Legacy Endpoint Requests',
              title_size: '16',
              title_align: 'left',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [{formula: 'query1'}],
                  queries: [
                    {
                      name: 'query1',
                      data_source: 'metrics',
                      query:
                        'sum:sentry.view.response{instance:sentry.monitors.endpoints.monitor_ingest_*}.as_count()',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'area',
                },
              ],
              markers: [],
            },
            layout: {x: 0, y: 6, width: 6, height: 3},
          },
          {
            id: 8424369280907449,
            definition: {
              title: 'Check-Ins by Request Per Second (RPS)',
              title_size: '16',
              title_align: 'left',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [
                    {
                      alias: 'First check-in/Heartbeat (POST)',
                      style: {palette: 'purple', palette_index: 7},
                      formula: 'autosmooth(query2)',
                    },
                    {
                      alias: 'Second check-in (PUT)',
                      style: {palette: 'purple', palette_index: 5},
                      formula: 'autosmooth(query3)',
                    },
                  ],
                  queries: [
                    {
                      query:
                        'sum:sentry.view.response{instance:sentry.monitors.endpoints.monitor_ingest_checkin_index.monitoringestcheckinindexendpoint}.as_rate()',
                      data_source: 'metrics',
                      name: 'query2',
                    },
                    {
                      query:
                        'sum:sentry.view.response{instance:sentry.monitors.endpoints.monitor_ingest_checkin_details.monitoringestcheckindetailsendpoint}.as_rate()',
                      data_source: 'metrics',
                      name: 'query3',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'line',
                },
              ],
            },
            layout: {x: 6, y: 6, width: 6, height: 3},
          },
        ],
      },
      layout: {x: 0, y: 16, width: 12, height: 10},
    },
    {
      id: 1538501771659832,
      definition: {
        title: 'System Health',
        background_color: 'vivid_pink',
        show_title: true,
        type: 'group',
        layout_type: 'ordered',
        widgets: [
          {
            id: 758242270516360,
            definition: {
              title: 'Overall Rate Limits',
              title_size: '16',
              title_align: 'left',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [
                    {alias: 'Consumer', formula: 'query1'},
                    {alias: 'API', formula: 'query2'},
                  ],
                  queries: [
                    {
                      name: 'query1',
                      data_source: 'metrics',
                      query:
                        'sum:sentry.monitors.checkin.dropped.ratelimited{source:consumer}.as_count()',
                    },
                    {
                      name: 'query2',
                      data_source: 'metrics',
                      query:
                        'sum:sentry.monitors.checkin.dropped.ratelimited{source:*,!source:consumer}.as_count()',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {palette: 'warm', line_type: 'solid', line_width: 'normal'},
                  display_type: 'area',
                },
              ],
            },
            layout: {x: 0, y: 0, width: 6, height: 2},
          },
          {
            id: 3968672910780988,
            definition: {
              title: 'Count of Monitor Check-ins Rows',
              title_size: '16',
              title_align: 'left',
              show_legend: false,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              time: {live_span: '3mo'},
              type: 'timeseries',
              requests: [
                {
                  formulas: [{formula: 'query1'}],
                  queries: [
                    {
                      query: 'sum:postgresql.live_rows{table:sentry_monitorcheckin}',
                      data_source: 'metrics',
                      name: 'query1',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'bars',
                },
                {
                  formulas: [
                    {
                      alias: 'trend line',
                      style: {palette: 'purple', palette_index: 5},
                      formula: 'trend_line(query0)',
                    },
                  ],
                  queries: [
                    {
                      data_source: 'metrics',
                      name: 'query0',
                      query: 'sum:postgresql.live_rows{table:sentry_monitorcheckin}',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'line',
                },
              ],
            },
            layout: {x: 6, y: 0, width: 6, height: 5},
          },
          {
            id: 4543712752842818,
            definition: {
              title: 'Check-In Queries Count',
              title_size: '16',
              title_align: 'left',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [{alias: 'Queries Count', formula: 'query1'}],
                  queries: [
                    {
                      data_source: 'metrics',
                      name: 'query1',
                      query:
                        'sum:postgresql.queries.count{table:sentry_monitorcheckin} by {query}.as_count()',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {palette: 'blue', line_type: 'solid', line_width: 'normal'},
                  display_type: 'bars',
                },
              ],
              markers: [],
            },
            layout: {x: 0, y: 2, width: 6, height: 3},
          },
          {
            id: 2914679718204622,
            definition: {
              title: 'Index Rows Read',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  response_format: 'timeseries',
                  queries: [
                    {
                      data_source: 'metrics',
                      name: 'query1',
                      query:
                        'sum:postgresql.index_rows_read{role:db_primary AND (index:sentry_monitorcheckin_status_3493d950 OR index:sentry_moni_monitor_7ed5ce_idx) AND $sentry_region} by {index,sentry_region}',
                    },
                  ],
                  formulas: [{formula: 'exclude_null(query1)'}],
                  style: {palette: 'cool', line_type: 'solid', line_width: 'normal'},
                  display_type: 'line',
                },
              ],
              yaxis: {scale: 'sqrt'},
              markers: [],
            },
            layout: {x: 0, y: 5, width: 3, height: 2},
          },
          {
            id: 6612219258608776,
            definition: {
              title: 'Index Rows Fetched',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  response_format: 'timeseries',
                  queries: [
                    {
                      data_source: 'metrics',
                      name: 'query1',
                      query:
                        'sum:postgresql.index_rows_fetched{role:db_primary AND (index:sentry_monitorcheckin_status_3493d950 OR index:sentry_moni_monitor_7ed5ce_idx) AND $sentry_region} by {index,sentry_region}',
                    },
                  ],
                  formulas: [{formula: 'exclude_null(query1)'}],
                  style: {palette: 'cool', line_type: 'solid', line_width: 'normal'},
                  display_type: 'line',
                },
              ],
              yaxis: {scale: 'sqrt'},
              markers: [],
            },
            layout: {x: 3, y: 5, width: 3, height: 2},
          },
          {
            id: 1150439972725504,
            definition: {
              title: 'API Latest Query',
              title_size: '16',
              title_align: 'left',
              show_legend: false,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  response_format: 'timeseries',
                  queries: [
                    {
                      query:
                        'sum:postgresql.queries.time{host:db-default-hd,query_signature:5416dc371e0c334}.as_count().fill(linear, 90)',
                      data_source: 'metrics',
                      name: 'postgresql_queries_time_num',
                    },
                    {
                      query:
                        'sum:postgresql.queries.count{host:db-default-hd,query_signature:5416dc371e0c334}.as_count().fill(linear, 60)',
                      data_source: 'metrics',
                      name: 'postgresql_queries_count_denom',
                    },
                  ],
                  formulas: [
                    {
                      formula:
                        'default_zero(postgresql_queries_time_num / postgresql_queries_count_denom)',
                    },
                  ],
                  display_type: 'line',
                },
                {
                  response_format: 'timeseries',
                  queries: [
                    {
                      query:
                        'sum:postgresql.queries.time{host:db-default-hd,!query_signature:5416dc371e0c334}.as_count().fill(linear, 90)',
                      data_source: 'metrics',
                      name: 'postgresql_queries_time_num',
                    },
                    {
                      query:
                        'sum:postgresql.queries.count{host:db-default-hd,!query_signature:5416dc371e0c334}.as_count().fill(linear, 60)',
                      data_source: 'metrics',
                      name: 'postgresql_queries_count_denom',
                    },
                  ],
                  formulas: [
                    {
                      formula:
                        'postgresql_queries_time_num / postgresql_queries_count_denom',
                    },
                  ],
                  style: {line_type: 'dotted'},
                  display_type: 'line',
                },
              ],
            },
            layout: {x: 6, y: 5, width: 3, height: 2},
          },
          {
            id: 6473884261747652,
            definition: {
              title: 'Consumer Latest Query',
              title_size: '16',
              title_align: 'left',
              show_legend: false,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  response_format: 'timeseries',
                  queries: [
                    {
                      query:
                        'sum:postgresql.queries.time{host:db-default-hd,query_signature:d777932f541208fb}.as_count().fill(linear, 90)',
                      data_source: 'metrics',
                      name: 'postgresql_queries_time_num',
                    },
                    {
                      query:
                        'sum:postgresql.queries.count{host:db-default-hd,query_signature:d777932f541208fb}.as_count().fill(linear, 60)',
                      data_source: 'metrics',
                      name: 'postgresql_queries_count_denom',
                    },
                  ],
                  formulas: [
                    {
                      formula:
                        'default_zero(postgresql_queries_time_num / postgresql_queries_count_denom)',
                    },
                  ],
                  display_type: 'line',
                },
                {
                  response_format: 'timeseries',
                  queries: [
                    {
                      query:
                        'sum:postgresql.queries.time{host:db-default-hd,!query_signature:d777932f541208fb}.as_count().fill(linear, 90)',
                      data_source: 'metrics',
                      name: 'postgresql_queries_time_num',
                    },
                    {
                      query:
                        'sum:postgresql.queries.count{host:db-default-hd,!query_signature:d777932f541208fb}.as_count().fill(linear, 60)',
                      data_source: 'metrics',
                      name: 'postgresql_queries_count_denom',
                    },
                  ],
                  formulas: [
                    {
                      formula:
                        'postgresql_queries_time_num / postgresql_queries_count_denom',
                    },
                  ],
                  style: {line_type: 'dotted'},
                  display_type: 'line',
                },
              ],
            },
            layout: {x: 9, y: 5, width: 3, height: 2},
          },
        ],
      },
      layout: {x: 0, y: 26, width: 12, height: 8, is_column_break: true},
    },
    {
      id: 6446195104934538,
      definition: {
        title: 'Check Monitors Task',
        show_title: true,
        type: 'group',
        layout_type: 'ordered',
        widgets: [
          {
            id: 7187579985220038,
            definition: {
              title: 'Missing Monitors to be Processed',
              title_size: '16',
              title_align: 'left',
              show_legend: false,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [{alias: 'monitors to be marked missed', formula: 'query1'}],
                  queries: [
                    {
                      query: 'sum:sentry.sentry.monitors.tasks.check_missing.count{*}',
                      data_source: 'metrics',
                      name: 'query1',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'bars',
                },
                {
                  formulas: [
                    {alias: 'anomalies', formula: "anomalies(query0, 'basic', 5)"},
                    {
                      alias: 'Trend-line',
                      style: {palette: 'classic', palette_index: 4},
                      formula: 'trend_line(query1)',
                    },
                  ],
                  queries: [
                    {
                      data_source: 'metrics',
                      name: 'query0',
                      query: 'sum:sentry.sentry.monitors.tasks.check_missing.count{*}',
                    },
                    {
                      data_source: 'metrics',
                      name: 'query1',
                      query: 'sum:sentry.sentry.monitors.tasks.check_missing.count{*}',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {palette: 'semantic', line_type: 'solid', line_width: 'normal'},
                  display_type: 'line',
                },
              ],
            },
            layout: {x: 0, y: 0, width: 4, height: 3},
          },
          {
            id: 2818985495878474,
            definition: {
              title: 'Check Missing Task Duration',
              title_size: '16',
              title_align: 'left',
              show_legend: false,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [{alias: 'execution time', formula: 'autosmooth(query1)'}],
                  queries: [
                    {
                      query:
                        'avg:sentry.jobs.duration.avg{instance:sentry.monitors.tasks.check_missing}',
                      data_source: 'metrics',
                      name: 'query1',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'bars',
                },
                {
                  formulas: [{formula: 'robust_trend(autosmooth(query1))'}],
                  queries: [
                    {
                      query:
                        'avg:sentry.jobs.duration.avg{instance:sentry.monitors.tasks.check_missing}',
                      data_source: 'metrics',
                      name: 'query1',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {palette: 'red', line_type: 'solid', line_width: 'normal'},
                  display_type: 'line',
                },
              ],
            },
            layout: {x: 4, y: 0, width: 4, height: 3},
          },
          {
            id: 6109797151885806,
            definition: {
              title: 'Check Missing Queue Time',
              title_size: '16',
              title_align: 'left',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [
                    {
                      number_format: {
                        unit: {type: 'canonical_unit', unit_name: 'millisecond'},
                      },
                      formula: 'query2',
                    },
                  ],
                  queries: [
                    {
                      name: 'query2',
                      data_source: 'metrics',
                      query:
                        'max:sentry.jobs.queue_time.avg{instance:sentry.monitors.tasks.mark_environment_missing}',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'bars',
                },
              ],
            },
            layout: {x: 8, y: 0, width: 4, height: 3},
          },
          {
            id: 2784887523904608,
            definition: {
              title: 'Timeout Check-ins to be Processed',
              title_size: '16',
              title_align: 'left',
              show_legend: false,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [
                    {alias: 'check-ins to be marked timeout', formula: 'query1'},
                  ],
                  queries: [
                    {
                      query: 'sum:sentry.sentry.monitors.tasks.check_timeout.count{*}',
                      data_source: 'metrics',
                      name: 'query1',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'bars',
                },
                {
                  formulas: [
                    {alias: 'anomalies', formula: "anomalies(query0, 'basic', 5)"},
                  ],
                  queries: [
                    {
                      data_source: 'metrics',
                      name: 'query0',
                      query: 'sum:sentry.sentry.monitors.tasks.check_timeout.count{*}',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {palette: 'semantic', line_type: 'solid', line_width: 'normal'},
                  display_type: 'line',
                },
              ],
            },
            layout: {x: 0, y: 3, width: 4, height: 3},
          },
          {
            id: 6130642583356962,
            definition: {
              title: 'Check Timeout Task Duration',
              title_size: '16',
              title_align: 'left',
              show_legend: false,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [{alias: 'execution time', formula: 'autosmooth(query1)'}],
                  queries: [
                    {
                      query:
                        'avg:sentry.jobs.duration.avg{instance:sentry.monitors.tasks.check_timeout}',
                      data_source: 'metrics',
                      name: 'query1',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'bars',
                },
                {
                  formulas: [{formula: 'robust_trend(autosmooth(query1))'}],
                  queries: [
                    {
                      query:
                        'avg:sentry.jobs.duration.avg{instance:sentry.monitors.tasks.check_timeout}',
                      data_source: 'metrics',
                      name: 'query1',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {palette: 'red', line_type: 'solid', line_width: 'normal'},
                  display_type: 'line',
                },
              ],
            },
            layout: {x: 4, y: 3, width: 4, height: 3},
          },
          {
            id: 2899146756582726,
            definition: {
              title: 'Check Timeout Queue Time',
              title_size: '16',
              title_align: 'left',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [
                    {
                      number_format: {
                        unit: {type: 'canonical_unit', unit_name: 'millisecond'},
                      },
                      formula: 'query2',
                    },
                  ],
                  queries: [
                    {
                      name: 'query2',
                      data_source: 'metrics',
                      query:
                        'max:sentry.jobs.queue_time.avg{instance:sentry.monitors.tasks.mark_checkin_timeout}',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'bars',
                },
              ],
            },
            layout: {x: 8, y: 3, width: 4, height: 3},
          },
          {
            id: 3928136639580738,
            definition: {
              title: 'Task Clock Delay (pulse_time - wall_clock_time)',
              title_size: '16',
              title_align: 'left',
              show_legend: false,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [{alias: 'seconds', formula: 'query1'}],
                  queries: [
                    {
                      query: 'max:sentry.monitors.task.clock_delay{*}',
                      data_source: 'metrics',
                      name: 'query1',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'bars',
                },
              ],
            },
            layout: {x: 0, y: 6, width: 4, height: 3},
          },
          {
            id: 4633857769687804,
            definition: {
              type: 'note',
              content:
                'Notes from Fillipo\n- Your throughput is the key to monitor and keep in order. As you will be running a constant rate of around 50 tasks per second, you will have to watch out to stick to your individual task execution time as scaling out will help you only till a certain point that is hard to predict.\n- Your control to prevent destroying the infra underneath is the max concurrency of your job. 2 ok, 5 ok, 10 probably ok, 20,000 not ok. So you limit the concurrency (it is done when deploying the worker) so that a degradation in performance of a single task that is too bad causes backlog instead of impacting the downstream systems.\n- You will need to be mindful to what you add to the task. If you add a clickhouse query that scans 1 week of data your task execution time is likely to jump from 40 ms to 1 second. Then you redo the math and you suddenly need 33 concurrent workers to run within one minute. Even if you autoscale, Snuba is likely to throttle you if one use case runs 33 queries concurrently. Which does by slowing down your query. Which makes you need even more workers, so you add more and .... this does not end well generally.\n- Keeping track of metrics about the avg execution time or maybe setting alerts is a good practice to stay on top of this scenario.\n- Batching may help if it allows you to collapse some queries or dropping some.',
              background_color: 'white',
              font_size: '14',
              text_align: 'left',
              vertical_align: 'top',
              show_tick: false,
              tick_pos: '50%',
              tick_edge: 'left',
              has_padding: true,
            },
            layout: {x: 8, y: 6, width: 4, height: 3},
          },
        ],
      },
      layout: {x: 0, y: 34, width: 12, height: 10},
    },
    {
      id: 2708048333487928,
      definition: {
        title: 'Alerts',
        type: 'manage_status',
        display_format: 'countsAndList',
        color_preference: 'text',
        hide_zero_counts: true,
        query: 'tag:crons',
        sort: 'status,asc',
        count: 50,
        start: 0,
        summary_type: 'monitors',
        show_priority: false,
        show_last_triggered: false,
      },
      layout: {x: 0, y: 0, width: 12, height: 6},
    },
  ],
  template_variables: [
    {name: 'sentry_region', prefix: 'sentry_region', available_values: [], default: '*'},
  ],
  layout_type: 'ordered',
  notify_list: [],
  reflow_type: 'fixed',
  tags: [],
};

export const ddmMetrics = {
  title: 'DDM',
  description: '[[suggested_dashboards]]',
  widgets: [
    {
      id: 3886658150461666,
      definition: {
        title: 'Minimetrics (Client)',
        show_title: true,
        type: 'group',
        layout_type: 'ordered',
        widgets: [
          {
            id: 3890547746412474,
            definition: {
              title: 'Flushed Buckets Sum',
              title_size: '16',
              title_align: 'left',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [{formula: 'query1'}],
                  queries: [
                    {
                      name: 'query1',
                      data_source: 'metrics',
                      query:
                        'sum:sentry.minimetrics.flushed_buckets.sum{$sentry_region} by {metric_type,force_flush}',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'bars',
                },
              ],
            },
            layout: {x: 0, y: 0, width: 4, height: 2},
          },
          {
            id: 568983133204344,
            definition: {
              title: 'Flushed Buckets Counter',
              title_size: '16',
              title_align: 'left',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [{formula: 'query1'}],
                  queries: [
                    {
                      name: 'query1',
                      data_source: 'metrics',
                      query:
                        'sum:sentry.minimetrics.flushed_buckets_counter{$sentry_region} by {metric_type,force_flush}.as_count()',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'bars',
                },
              ],
            },
            layout: {x: 4, y: 0, width: 4, height: 2},
          },
          {
            id: 6416225133506274,
            definition: {
              title: 'Tracked Metrics by Type',
              title_size: '16',
              title_align: 'left',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [{formula: 'query1'}],
                  queries: [
                    {
                      name: 'query1',
                      data_source: 'metrics',
                      query:
                        'sum:sentry.minimetrics.add{$sentry_region} by {metric_type}.as_rate()',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'bars',
                },
              ],
            },
            layout: {x: 8, y: 0, width: 4, height: 2},
          },
          {
            id: 3263559780943748,
            definition: {
              title: 'Flushed Buckets Weight Sum',
              title_size: '16',
              title_align: 'left',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [{formula: 'query1'}],
                  queries: [
                    {
                      name: 'query1',
                      data_source: 'metrics',
                      query:
                        'sum:sentry.minimetrics.flushed_buckets_weight.sum{$sentry_region} by {metric_type,force_flush}',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'bars',
                },
              ],
            },
            layout: {x: 0, y: 2, width: 4, height: 2},
          },
          {
            id: 8091913012924968,
            definition: {
              title: 'Flushed Buckets Weight Counter',
              title_size: '16',
              title_align: 'left',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [{formula: 'query1'}],
                  queries: [
                    {
                      name: 'query1',
                      data_source: 'metrics',
                      query:
                        'sum:sentry.minimetrics.flushed_buckets_weight_counter{$sentry_region} by {metric_type}.as_count()',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'bars',
                },
              ],
            },
            layout: {x: 4, y: 2, width: 4, height: 2},
          },
          {
            id: 571706216074124,
            definition: {
              title: 'Flushed Buckets Max Weight',
              title_size: '16',
              title_align: 'left',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [{formula: 'query1'}, {formula: 'query2'}],
                  queries: [
                    {
                      name: 'query1',
                      data_source: 'metrics',
                      query:
                        'max:sentry.minimetrics.flushed_buckets_weight.max{$sentry_region} by {metric_type}',
                    },
                    {
                      name: 'query2',
                      data_source: 'metrics',
                      query:
                        'avg:sentry.minimetrics.flushed_buckets_weight.avg{$sentry_region} by {metric_type}',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'line',
                },
              ],
            },
            layout: {x: 8, y: 2, width: 4, height: 2},
          },
          {
            id: 8243014829036564,
            definition: {
              title: 'Envelope Size in Bytes',
              title_size: '16',
              title_align: 'left',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [
                    {formula: 'query1'},
                    {formula: 'query2'},
                    {formula: 'query3'},
                  ],
                  queries: [
                    {
                      name: 'query1',
                      data_source: 'metrics',
                      query:
                        'avg:sentry.minimetrics.encoded_metrics_size.avg{$sentry_region}',
                    },
                    {
                      name: 'query2',
                      data_source: 'metrics',
                      query:
                        'max:sentry.minimetrics.encoded_metrics_size.95percentile{$sentry_region}.rollup(max)',
                    },
                    {
                      name: 'query3',
                      data_source: 'metrics',
                      query:
                        'max:sentry.minimetrics.encoded_metrics_size.max{$sentry_region}.rollup(max)',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'line',
                },
              ],
            },
            layout: {x: 0, y: 4, width: 4, height: 2},
          },
          {
            id: 5988885644445700,
            definition: {
              title: 'Number of emitted Envelopes',
              title_size: '16',
              title_align: 'left',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [{formula: 'query1'}],
                  queries: [
                    {
                      name: 'query1',
                      data_source: 'metrics',
                      query:
                        'sum:sentry.minimetrics.encoded_metrics_size.count{*}.as_rate()',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'line',
                },
              ],
            },
            layout: {x: 4, y: 4, width: 4, height: 2},
          },
          {
            id: 7207318247780317,
            definition: {
              title: 'CPU Throttling',
              title_size: '16',
              title_align: 'left',
              show_legend: false,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  response_format: 'timeseries',
                  queries: [
                    {
                      query:
                        'sum:kubernetes.cpu.cfs.throttled.seconds{kube_namespace:default,kube_deployment:getsentry-worker-save-production,cluster-name:zdpwkxst,*,*,*,*} by {kube_namespace,kube_deployment,kube_daemon_set,kube_job,kube_stateful_set,kube_container_name,sentry_region}.fill(zero)',
                      data_source: 'metrics',
                      name: 'query1',
                    },
                  ],
                  style: {palette: 'warm', line_type: 'solid', line_width: 'normal'},
                  display_type: 'line',
                },
              ],
              yaxis: {scale: 'sqrt'},
              markers: [
                {label: ' rekt ', value: 'y = 0.1', display_type: 'error dashed'},
              ],
            },
            layout: {x: 8, y: 4, width: 4, height: 2},
          },
        ],
      },
      layout: {x: 0, y: 0, width: 12, height: 7},
    },
    {
      id: 7325779751738330,
      definition: {
        title: 'Relay',
        show_title: true,
        type: 'group',
        layout_type: 'ordered',
        widgets: [
          {
            id: 7093825718059668,
            definition: {
              title: 'Buckets Created (sum over all Relays)',
              title_size: '16',
              title_align: 'left',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [{formula: 'query1'}],
                  queries: [
                    {
                      query:
                        'sum:relay.metrics.buckets.merge.miss{(sentry_region:us OR sentry_region:us1) AND namespace:custom}.as_rate().rollup(sum)',
                      data_source: 'metrics',
                      name: 'query1',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'area',
                },
              ],
              yaxis: {
                include_zero: true,
                scale: 'linear',
                label: '',
                min: 'auto',
                max: 'auto',
              },
              markers: [],
            },
            layout: {x: 0, y: 0, width: 4, height: 2},
          },
          {
            id: 162975658336904,
            definition: {
              title: 'Avg Values per Bucket',
              title_size: '16',
              title_align: 'left',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [{formula: 'query1'}],
                  queries: [
                    {
                      name: 'query1',
                      data_source: 'metrics',
                      query:
                        'avg:relay.metrics.buckets.size{* AND (sentry_region:us OR sentry_region:us1) AND namespace:custom} by {metric_type}',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'area',
                },
              ],
            },
            layout: {x: 4, y: 0, width: 4, height: 2},
          },
          {
            id: 5674893938048850,
            definition: {
              title: 'Kafka Messages Produced',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [{formula: 'query1'}],
                  queries: [
                    {
                      query:
                        'sum:relay.processing.event.produced{$sentry_region, event_type:metric} by {sentry_region}.as_rate()',
                      data_source: 'metrics',
                      name: 'query1',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'area',
                },
              ],
              yaxis: {
                include_zero: true,
                scale: 'linear',
                label: '',
                min: 'auto',
                max: 'auto',
              },
            },
            layout: {x: 8, y: 0, width: 4, height: 2},
          },
        ],
      },
      layout: {x: 0, y: 7, width: 12, height: 3, is_column_break: true},
    },
    {
      id: 8978819368301500,
      definition: {
        title: 'Consumers',
        show_title: true,
        type: 'group',
        layout_type: 'ordered',
        widgets: [
          {
            id: 2721970455449710,
            definition: {
              title: 'Indexer Consumer Time Spent by Phase',
              title_size: '16',
              title_align: 'left',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [
                    {alias: 'produce step flush', formula: 'query1'},
                    {alias: 'bulk record', formula: 'query2'},
                    {alias: 'reconstruct', formula: 'query4'},
                    {alias: 'check cardinality limits', formula: 'query5'},
                    {alias: 'extract messages', formula: 'query6'},
                    {alias: 'apply cardinality limits', formula: 'query7'},
                  ],
                  queries: [
                    {
                      query:
                        'sum:sentry.simple_produce_step.join_duration.sum{pipeline:perf,*}.rollup(sum)',
                      data_source: 'metrics',
                      name: 'query1',
                    },
                    {
                      query:
                        'sum:sentry.metrics_consumer.bulk_record.sum{pipeline:perf,*}.rollup(sum)',
                      data_source: 'metrics',
                      name: 'query2',
                    },
                    {
                      query:
                        'sum:sentry.process_messages.reconstruct_messages.sum{pipeline:perf,*}.rollup(sum)',
                      data_source: 'metrics',
                      name: 'query4',
                    },
                    {
                      query:
                        'sum:sentry.metrics_consumer.check_cardinality_limits.sum{pipeline:perf,*}.rollup(sum)',
                      data_source: 'metrics',
                      name: 'query5',
                    },
                    {
                      query:
                        'sum:sentry.process_messages.extract_messages.sum{pipeline:perf,*}.rollup(sum)',
                      data_source: 'metrics',
                      name: 'query6',
                    },
                    {
                      query:
                        'sum:sentry.metrics_consumer.apply_cardinality_limits.sum{pipeline:perf,*}.rollup(sum)',
                      data_source: 'metrics',
                      name: 'query7',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'area',
                },
              ],
            },
            layout: {x: 0, y: 0, width: 4, height: 2},
          },
        ],
      },
      layout: {x: 0, y: 10, width: 12, height: 3},
    },
  ],
  template_variables: [
    {name: 'sentry_region', prefix: 'sentry_region', available_values: [], default: 'us'},
  ],
  layout_type: 'ordered',
  notify_list: [],
  template_variable_presets: [
    {
      name: 'S4S',
      template_variables: [{name: 'sentry_region', value: 'st-sentry4sentry'}],
    },
    {name: 'SaaS (US)', template_variables: [{name: 'sentry_region', value: 'us'}]},
  ],
  reflow_type: 'fixed',
};

export const dynamicSampling = {
  title: 'Dynamic Sampling',
  description: null,
  widgets: [
    {
      id: 1718748217531372,
      definition: {
        title: 'Sentry Dynamic Sampling',
        show_title: true,
        type: 'group',
        layout_type: 'ordered',
        widgets: [
          {
            id: 2202039667653673,
            definition: {
              title: 'Project Configuration Cache Purges',
              title_size: '16',
              title_align: 'left',
              show_legend: false,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [
                    {alias: 'skipped', formula: 'query2'},
                    {alias: 'scheduled', formula: 'query3'},
                  ],
                  queries: [
                    {
                      query:
                        'sum:sentry.relay.projectconfig_cache.skipped{update_reason IN (dynamic_sampling_sliding_window,dynamic_sampling_boost_low_volume_projects,dynamic_sampling_boost_low_volume_transactions,dynamic_sampling:boost_release)} by {update_reason}.as_count()',
                      data_source: 'metrics',
                      name: 'query2',
                    },
                    {
                      query:
                        'sum:sentry.relay.projectconfig_cache.scheduled{update_reason IN (dynamic_sampling_sliding_window,dynamic_sampling_boost_low_volume_projects,dynamic_sampling_boost_low_volume_transactions,dynamic_sampling:boost_release)} by {update_reason}.as_count()',
                      data_source: 'metrics',
                      name: 'query3',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'bars',
                },
              ],
            },
            layout: {x: 0, y: 0, width: 6, height: 2},
          },
        ],
      },
      layout: {x: 0, y: 0, width: 6, height: 3},
    },
    {
      id: 5101793065610182,
      definition: {
        title: 'Relay Dynamic Sampling',
        show_title: true,
        type: 'group',
        layout_type: 'ordered',
        widgets: [
          {
            id: 8920735154140864,
            definition: {
              title: 'Relay Outcomes: Filtered',
              show_legend: true,
              legend_layout: 'horizontal',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [{alias: 'Filtered', formula: 'query3'}],
                  queries: [
                    {
                      query:
                        'sum:relay.events.outcomes{to:kafka,outcome:filtered,reason:sampled:*}.as_rate()',
                      data_source: 'metrics',
                      name: 'query3',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {palette: 'cool', line_type: 'solid', line_width: 'normal'},
                  display_type: 'line',
                },
              ],
              yaxis: {
                include_zero: true,
                scale: 'linear',
                label: '',
                min: 'auto',
                max: 'auto',
              },
              markers: [],
            },
            layout: {x: 0, y: 0, width: 3, height: 2},
          },
          {
            id: 5360675347381008,
            definition: {
              title: 'Relay Outcomes: Filtered by Reason',
              show_legend: true,
              legend_layout: 'horizontal',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [{formula: 'query4'}],
                  queries: [
                    {
                      query:
                        'sum:relay.events.outcomes{to:kafka AND outcome:accepted OR (outcome:filtered AND reason:sampled:*)} by {reason}.as_rate()',
                      data_source: 'metrics',
                      name: 'query4',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {palette: 'cool', line_type: 'solid', line_width: 'normal'},
                  display_type: 'line',
                },
              ],
              yaxis: {
                include_zero: true,
                scale: 'linear',
                label: '',
                min: 'auto',
                max: 'auto',
              },
              markers: [],
            },
            layout: {x: 3, y: 0, width: 3, height: 2},
          },
        ],
      },
      layout: {x: 6, y: 0, width: 6, height: 3},
    },
    {
      id: 1103777878748690,
      definition: {
        title: 'Boost Low Volume Projects',
        show_title: true,
        type: 'group',
        layout_type: 'ordered',
        widgets: [
          {
            id: 5598673045538182,
            definition: {
              title: 'Boost Low Volume Projects',
              title_size: '16',
              title_align: 'left',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [{formula: 'query1'}],
                  queries: [
                    {
                      name: 'query1',
                      data_source: 'metrics',
                      query:
                        'avg:sentry.sentry.tasks.dynamic_sampling.boost_low_volume_projects.avg{*}',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'bars',
                },
              ],
            },
            layout: {x: 0, y: 0, width: 2, height: 2},
          },
          {
            id: 6909892682738872,
            definition: {
              title: 'Boost Low Volume Projects of Org',
              title_size: '16',
              title_align: 'left',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [{formula: 'query1'}],
                  queries: [
                    {
                      name: 'query1',
                      data_source: 'metrics',
                      query:
                        'avg:sentry.sentry.tasks.dynamic_sampling.boost_low_volume_projects_of_org.avg{*}',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'bars',
                },
              ],
            },
            layout: {x: 2, y: 0, width: 2, height: 2},
          },
          {
            id: 3408674035348742,
            definition: {
              title: 'Boost Low Volume Projects Start',
              title_size: '16',
              title_align: 'left',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [{formula: 'query1'}],
                  queries: [
                    {
                      name: 'query1',
                      data_source: 'metrics',
                      query:
                        'avg:sentry.sentry.tasks.dynamic_sampling.boost_low_volume_projects.start{*}.as_count()',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'bars',
                },
              ],
            },
            layout: {x: 4, y: 0, width: 2, height: 2},
          },
        ],
      },
      layout: {x: 0, y: 0, width: 6, height: 3},
    },
    {
      id: 4263136856516030,
      definition: {
        title: 'Boost Low Volume Transactions',
        show_title: true,
        type: 'group',
        layout_type: 'ordered',
        widgets: [
          {
            id: 3720805826900358,
            definition: {
              title: 'Boost Low Volume Transactions',
              title_size: '16',
              title_align: 'left',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [
                    {style: {palette: 'classic', palette_index: 3}, formula: 'query1'},
                  ],
                  queries: [
                    {
                      name: 'query1',
                      data_source: 'metrics',
                      query:
                        'avg:sentry.sentry.tasks.dynamic_sampling.boost_low_volume_transactions.avg{*}',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'bars',
                },
              ],
            },
            layout: {x: 0, y: 0, width: 2, height: 2},
          },
          {
            id: 3366860016095090,
            definition: {
              title: 'Boost Low Volume Transactions of Project',
              title_size: '16',
              title_align: 'left',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [
                    {style: {palette: 'purple', palette_index: 4}, formula: 'query1'},
                  ],
                  queries: [
                    {
                      name: 'query1',
                      data_source: 'metrics',
                      query:
                        'avg:sentry.sentry.tasks.dynamic_sampling.boost_low_volume_transactions_of_project.avg{*}',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'bars',
                },
              ],
            },
            layout: {x: 2, y: 0, width: 2, height: 2},
          },
          {
            id: 7317811386662442,
            definition: {
              title: 'Boost Low Volume Transactions Start',
              title_size: '16',
              title_align: 'left',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [
                    {style: {palette: 'purple', palette_index: 4}, formula: 'query1'},
                  ],
                  queries: [
                    {
                      name: 'query1',
                      data_source: 'metrics',
                      query:
                        'avg:sentry.sentry.tasks.dynamic_sampling.boost_low_volume_transactions.start{*}.as_count()',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'bars',
                },
              ],
            },
            layout: {x: 4, y: 0, width: 2, height: 2},
          },
        ],
      },
      layout: {x: 6, y: 0, width: 6, height: 3},
    },
    {
      id: 2801266117398144,
      definition: {
        title: 'Sliding Window Org',
        show_title: true,
        type: 'group',
        layout_type: 'ordered',
        widgets: [
          {
            id: 262315674758534,
            definition: {
              title: 'Sliding Window Org',
              title_size: '16',
              title_align: 'left',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [
                    {style: {palette: 'green', palette_index: 5}, formula: 'query1'},
                  ],
                  queries: [
                    {
                      name: 'query1',
                      data_source: 'metrics',
                      query:
                        'avg:sentry.sentry.tasks.dynamic_sampling.sliding_window_org.avg{*}',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'bars',
                },
              ],
            },
            layout: {x: 0, y: 0, width: 3, height: 2},
          },
          {
            id: 5808550503482690,
            definition: {
              title: 'Sliding Window Org Start',
              title_size: '16',
              title_align: 'left',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [
                    {style: {palette: 'green', palette_index: 5}, formula: 'query1'},
                  ],
                  queries: [
                    {
                      name: 'query1',
                      data_source: 'metrics',
                      query:
                        'avg:sentry.sentry.tasks.dynamic_sampling.sliding_window_org.start{*}.as_count()',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'bars',
                },
              ],
            },
            layout: {x: 3, y: 0, width: 3, height: 2},
          },
        ],
      },
      layout: {x: 0, y: 0, width: 6, height: 3, is_column_break: true},
    },
    {
      id: 5327204126483764,
      definition: {
        title: 'Recalibrate Orgs',
        show_title: true,
        type: 'group',
        layout_type: 'ordered',
        widgets: [
          {
            id: 2299080309924262,
            definition: {
              title: 'Recalibrate Orgs',
              title_size: '16',
              title_align: 'left',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [
                    {style: {palette: 'warm', palette_index: 2}, formula: 'query1'},
                  ],
                  queries: [
                    {
                      name: 'query1',
                      data_source: 'metrics',
                      query:
                        'avg:sentry.sentry.tasks.dynamic_sampling.recalibrate_orgs.avg{*}',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'bars',
                },
              ],
            },
            layout: {x: 0, y: 0, width: 3, height: 2},
          },
          {
            id: 2678293370646774,
            definition: {
              title: 'Recalibrate Orgs Start',
              title_size: '16',
              title_align: 'left',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [
                    {style: {palette: 'warm', palette_index: 2}, formula: 'query1'},
                  ],
                  queries: [
                    {
                      name: 'query1',
                      data_source: 'metrics',
                      query:
                        'avg:sentry.sentry.tasks.dynamic_sampling.recalibrate_orgs.start{*}.as_count()',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'bars',
                },
              ],
            },
            layout: {x: 3, y: 0, width: 3, height: 2},
          },
        ],
      },
      layout: {x: 6, y: 0, width: 6, height: 3},
    },
    {
      id: 5296632066905732,
      definition: {
        title: 'System Health',
        show_title: true,
        type: 'group',
        layout_type: 'ordered',
        widgets: [],
      },
      layout: {x: 0, y: 9, width: 12, height: 1},
    },
    {
      id: 4515889658806524,
      definition: {
        title: 'Sliding Window (Disabled)',
        show_title: true,
        type: 'group',
        layout_type: 'ordered',
        widgets: [
          {
            id: 4381868574652434,
            definition: {
              title: 'Sliding Window',
              title_size: '16',
              title_align: 'left',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [
                    {style: {palette: 'cool', palette_index: 4}, formula: 'query1'},
                  ],
                  queries: [
                    {
                      name: 'query1',
                      data_source: 'metrics',
                      query:
                        'avg:sentry.sentry.tasks.dynamic_sampling.sliding_window.avg{*}',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'bars',
                },
              ],
            },
            layout: {x: 6, y: 0, width: 3, height: 2},
          },
          {
            id: 4979678856038750,
            definition: {
              title: 'Sliding Window Start',
              title_size: '16',
              title_align: 'left',
              show_legend: true,
              legend_layout: 'auto',
              legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
              type: 'timeseries',
              requests: [
                {
                  formulas: [
                    {style: {palette: 'cool', palette_index: 4}, formula: 'query1'},
                  ],
                  queries: [
                    {
                      name: 'query1',
                      data_source: 'metrics',
                      query:
                        'avg:sentry.sentry.tasks.dynamic_sampling.sliding_window.start{*}.as_count()',
                    },
                  ],
                  response_format: 'timeseries',
                  style: {
                    palette: 'dog_classic',
                    line_type: 'solid',
                    line_width: 'normal',
                  },
                  display_type: 'bars',
                },
              ],
            },
            layout: {x: 9, y: 0, width: 3, height: 2},
          },
        ],
      },
      layout: {x: 0, y: 10, width: 12, height: 3},
    },
  ],
  template_variables: [],
  layout_type: 'ordered',
  notify_list: [],
  reflow_type: 'fixed',
};
