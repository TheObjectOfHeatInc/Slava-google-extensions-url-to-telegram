bkg = chrome.extension.getBackgroundPage(); // Récupération d'une référence vers la backgroundpage
// Affichage du nombre d'URL copiées, message envoyé par la background page
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse){
	if (typeof request.type != 'string') return;
	switch(request.type){
		case "copy":
			let nombre = (request.copied_url > 1) ? 's' : '';
			jQuery('#message').removeClass('error').html("<b>"+request.copied_url+"</b> url"+nombre+" successfully copied !");
			setTimeout(function(){window.close();}, 3000); // Fermeture de la popup quelques secondes après affichage du message
			break;
	}
});

/**
* Gestion des boutons de la popup
*/
jQuery(function($){
	$('#actionCopy').on('click', function(e, fromDefaultAction){
		let gaEvent = {
			action: 'Copy',
			label: (fromDefaultAction === true) ? 'BrowserAction' : 'Popup',
		};

		// On récupére la fenêtre courante
		chrome.windows.getCurrent(function(win){
			bkg.Action.copy({window: win, gaEvent: gaEvent});
		});
	});

	// Default action
	let default_action = localStorage['default_action'] ? localStorage['default_action'] : "menu";
	if( default_action !== "menu" ){
		// Masquage des boutons
		$('body>ul').hide();
		$('#message').css({'padding':'3px 0 5px'});
		
		// Déclenchement de l'action par défaut configurée dans les options
		switch(default_action){
			case "copy":
				$('#actionCopy').trigger('click', [true]);
				break;
		}
	}
});