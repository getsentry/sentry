if (Sentry === undefined) {
    var Sentry = {};
}
(function(){
    function getRankedPosition(list, value, idx) {
        for (var i=0, item; (item = list[i]); i++) {
            if (value > item[idx]) {
                return i;
            }
        }
        return -1;
    }
    function getPosition(list, value, idx) {
        for (var i=0, item; (item = list[i]); i++) {
            if (value == item[idx]) {
                return i;
            }
        }
        return -1;
    }
    Sentry.realtime = {};
    Sentry.realtime.options = {
        viewId: null,
        projectId: null
    };
    Sentry.realtime.status = false;
    Sentry.realtime.queue = Queue({high: true});

    Sentry.realtime.init = function(){
        var sorted = [];
        $('#event_list .event').each(function(i, el){
            var $el = $(el);
            sorted.push([$el.attr('data-score'), $el.attr('id')]);
        });
        Sentry.realtime.events = sorted;

        $('#sentry-realtime').click(function(){
            if (Sentry.realtime.status) {
                Sentry.realtime.disable();
            } else {
                Sentry.realtime.enable();
            }
        });
        Sentry.realtime.poll();
        setInterval(Sentry.realtime.tick, 300);
    };

    Sentry.realtime.config = function(data){
        $.each(data, function(k, v){
            Sentry.realtime.options[k] = v;
        });
    };

    Sentry.realtime.toggle = function(){
        if (Sentry.realtime.status) {
            Sentry.realtime.enable();
        } else {
            Sentry.realtime.disable();
        }
    };

    Sentry.realtime.enable = function(){
        var $el = $('#sentry-realtime');
        $el.removeClass('realtime-play');
        $el.addClass('realtime-pause');
        $el.text('Pause Feed');
        Sentry.realtime.status = true;
    };

    Sentry.realtime.disable = function(){
        var $el = $('#sentry-realtime');
        $el.addClass('realtime-play');
        $el.removeClass('realtime-pause');
        $el.text('Go Live');
        Sentry.realtime.status = false;
    };

    Sentry.realtime.tick = function(){
        if (Sentry.realtime.queue.empty()) {
            return;
        }
        var data = Sentry.realtime.queue.pop();
        var id = 'group_' + data.id;
        var $row = $('#' + id);
        var is_new = ($row.length === 0);

        // ensure "no messages" is cleaned up
        $('#no_messages').remove();

        // resort because we suck at javascript
        Sentry.realtime.events.sort(function(a, b){
            return b[0] - a[0];
        });

        // if the row already was present, let's make sure
        // the count changed
        if (!is_new) {
            if ($row.attr('data-count') == data.count) {
                return;
            }
        }

        // get the ranked position based on data.score
        pos = getRankedPosition(Sentry.realtime.events, data.score, 0);

        // check to see if the row already exists in the sort,
        // and get the current position
        old_pos = getPosition(Sentry.realtime.events, id, 1);

        // if the row was already present, adjust its score
        if (old_pos !== -1) {
            Sentry.realtime.events[old_pos][0] = data.score;
            if (old_pos == pos) {
                return;
            }
            $row.remove();
        } else if (!is_new) {
            $row.remove();
        }

        $row = $(data.html);

        // if the row doesnt outrank any existing elements
        if (pos === -1) {
            $('#event_list').append($row);
        } else {
            $('#' + Sentry.realtime.events[pos][1]).before($row);
        }

        // insert it into the events list at the current position
        if (is_new) {
            Sentry.realtime.events.splice(pos, 0, [data.score, id]);
        }

        // shiny fx
        $row.css('background-color', '#ddd').animate({backgroundColor: '#fff'}, 1200);
    };

    Sentry.realtime.poll = function(){
        if (!Sentry.realtime.status) {
            setTimeout(Sentry.realtime.poll, 1000);
            return;
        }
        data = getQueryParams();
        data.view_id = Sentry.realtime.options.viewId || undefined;
        data.cursor = Sentry.realtime.cursor || undefined;
        $.ajax({
            url: Sentry.options.urlPrefix + '/api/' + Sentry.realtime.options.projectId + '/poll/',
            type: 'get',
            dataType: 'json',
            data: data,
            success: function(groups){
                if (!groups.length) {
                    setTimeout(Sentry.realtime.poll, 5000);
                    return;
                }
                Sentry.realtime.cursor = groups[groups.length - 1].score || undefined;
                $(groups).each(function(i, data){
                    Sentry.realtime.queue.replace(data, data.score, 'id');
                });
                setTimeout(Sentry.realtime.poll, 1000);
            },
            error: function(){
                // if an error happened lets give the server a bit of time before we poll again
                setTimeout(Sentry.realtime.poll, 10000);
            }
        });

        // make sure we limit the number shown
        while (Sentry.realtime.events.length > 50) {
            var item = Sentry.realtime.events.pop();
            $("#" + item[1]).remove();
        }
    };

    $(document).ready(function(){
        Sentry.realtime.init();
    });

}());