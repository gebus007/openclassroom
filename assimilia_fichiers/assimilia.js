//QUIZZ
//A part le constructeur, seules les fonctions start et checkAnswer sont àtiliser, les autres fonctions sont internes (mais il n'y a pas la possibilité à ce jour de les définir en javascript comme étant privées)
var Quizz = new Class({
	Implements: [Options, Events],
	options: {
		title : 'Quizz title',
		solutions : new Array(),
		solutionsKeys : new Array(),
		toBeShuffled : true, //les questions du quizz doivent-elles êtres mélangées ?
		nbSecondsClues : 5, //nombre de secondes à attendre avant de pouvoir avoir des indices
		pointsPerGoodAnswer : 5, //TODO : contrôle anti trichie => mettre un contrôle en ajax pour vérifier que la valeur n'est pas modifiée... (faire pareil pour d'autres variables)
		comboMax : 3, //taille maximum du combo
		trainingLbl : 'Training',
		difficulty1Lbl : 'Easy',
		difficulty2Lbl : 'Medium',
		difficulty3Lbl : 'Hard',
		questionContext : 'Question to ask',
		countdownPrefix : '',
		countdownSuffix : '',
		countdownFinalMsg : '',
		countdownCluesPrefix : '',
		countdownCluesSuffix : '',
		countdownCluesFinalMsg : '',
		availableCluesThresold : 5,  //seuil d'indices disponibles pour pouvoir en obtenir 
		okLbl : 'OK',
		resultTitle : 'Results',
		scoreMsg : 'Score : ',
		completedMsg : 'Quizz completed !',
		congratulationMsg : 'Congratulation !',
		nbFaultsMsg : 'Faults done :',
		finalSolutionMsg : '',
		statsCorrects : 'Corrects', 
		statsFaults : 'Faults', 
		statsRemaining : 'Remaining',
		resetBtnLbl : 'Restart'
	},
	initialize: function (options){
		
		this.setOptions(options);
		
		//on prépare l'info bulle sur chaque zone jouable (ou volontairement non joué) de la carte 
		/*this.tips = new Tips($$('.base'), { className: 'map_tip' });
		this.tipsNotUsed = new Tips($$('.notused'), { className: 'map_tip' });
		this.tipsNotUsed.hide();*/
		
		this.reset();
		
		this.createZoomPanel();
	},
	
	reset: function(){
		this.index = 0; //on met l'index à 0
		
		this.isCompleted = false; //variable utilisée pour savoir si le quizz est terminé ou non
		
		this.length = this.options.solutions.length; //on note le nombre d'éléments du quizz : ce nombre est stable
		
		this.score = 0; //on met les points à 0
		
		this.combo = 0; //on met les combos à 0
		
		this.setLevel(1); //on règle le niveau par défaut au plus facile
		
		//on affiche le panneau d'indications
		this.createIndicatorPanel();
		
		//on affiche le panneau de jeu
		this.createQuestionPanel();
		
		//on retire les éventuelles corrections et panel de résultat
		this.removeResults();
		
		//on définit l'ordre de lecture des questions ; on prend pour le moment celui par défaut, il s'agit donc d'une liste consécutive
		this.solutionsLayout = new Array();
		for (var i = 0 ; i < this.length ; i++) {
			this.solutionsLayout[i] = i;
		}
		if(this.options.toBeShuffled) {
			//on mélange les questions
			this.solutionsLayout.shuffle();
		}
		
		//pour chaque zone survolable, on affecte une classe css et on retire le titre
		var key;
		for (var i = 0 ; i < this.length ; i++) {
			key = this.getSolutionKey(i);
			$(key).setAttribute('onclick', '');
			$(key).setAttribute('class', 'base');
			$(key).setAttribute('title', '');
			$(key).setStyle('cursor', 'auto');
		}
		
		//on prépare le tableau servant à noter les mauvaises réponses
		this.wrongAnswers = new Array();
		
		//on prépare tableau contenant les indices pour la question en cours (il s'agit d'une liste de choix possibles)
		this.clues = new Array();
		
		this.domEndGamePanel = null;
		
	},
	
	//démarrage du quizz 
	//@level : niveau de difficulté (de 0 à 3, avec 0 pour mode entraînement)
	start: function(level) {
		
		this.setLevel(level);
		
		//on rend les zones cliquables
		var key;
		for (var i = 0 ; i < this.length ; i++) {
			key = this.getSolutionKey(i);
			//$(key).setAttribute('onclick', 'checkAnswer(\'' + key + '\')');
			$(key).addEvent('click', function(event) {this.checkAnswer(event.target.id)}.bind(this));
		}
		
		//on prépare le compte à rebours du quizz
		if(! this.isTraining()) {
			var self = this;
			this.countdown = new Countdown({
				durationInSeconds: self.getDurationInSeconds(),
				fctToDo: function () {
					self.endQuizz();
				},
				gui: self.getDomCountdown(),
				txtPrefix : self.options.countdownPrefix,
				txtSuffix : self.options.countdownSuffix
			});
			
			//... et on le lance
			this.countdown.start();

		}
		
		//on supprime le bouton de démarrage
		//this.options.domStartBtn.dispose();		
		
		//on pose la question
		this.askQuestion();
		
	},
	
	checkAnswer: function(key){
		var rightKey = this.getCurrentSolutionKey();
		
		//on "retire" la correction précédente
		if (this.index > 0 && $(this.getSolutionKey(this.index - 1)).getAttribute('class') == 'correction'){ 		//TODO : à mettre dans quizzMap, voire trouver une solution plus gꯩrique...
			$(this.getSolutionKey(this.index - 1)).setAttribute('class', 'base');
		}
		//puis on vérifie la réponse
		//BONNE REPONSE !
		if (key == rightKey){
			//on met la zone en couleur //TODO : mettre dans quizzMap
			$(key).setAttribute('class', 'correct');
			
			//... et on retire la possibilité de cliquer dessus //TODO : mettre dans quizzMap
			$(key).setAttribute('onclick', '');
			
			if(! this.isTraining()) {
				//on met des points 
				this.setScore(this.getScore() + this.options.pointsPerGoodAnswer + this.getCombo());
				this.refreshScore();
				
				//on incrémente le combo
				if(this.getCombo() < this.options.comboMax) {
					this.setCombo(this.getCombo() + 1);
					//et on met à jour la partie graphique
					this.refreshCombo();
				}
				
				//on ajoute du temps au compte à rebours
				this.countdown.addTime(this.getNbSecondsBonus());
			}			
		}
		else { 
			//MAUVAISE REPONSE 
			
			//on affiche la correction //TODO : mettre dans quizzMap, voire trouver une solution plus générique
			$(rightKey).setAttribute('class', 'correction');
			this.wrongAnswers.push(rightKey);
			
			//on agrossit rapidement la zone en question (puis retour à la normale)
			
			if(! this.isTraining()) {
				//on remet les combos à 0
				this.setCombo(0);
				this.refreshCombo();
			}
		}
		this.nextQuestion();
	},
	
	nextQuestion: function(){
		
		//on retire les indices
		this.removeOldClues();
		
		this.index = this.index + 1;
		
		//on vérifie si le quizz est terminé
		if (this.index == this.length) {
			this.isCompleted = true;
			this.endQuizz();
		}
		else {
			this.askQuestion();			
		}		
	},
	
	//pose la question du quizz et affiche son numéro
	askQuestion: function(){
		//on met le n° de la question
		this.displayQuestionNb((this.index + 1) + '/' + this.length);
		
		//on met l'intitulé de la question
		this.displayQuestionContext(this.options.questionContext);
		this.displayQuestionSpot(this.getCurrentSolution());
		
		//on prépare les indices
		this.prepareClues();
	},
	
	//prépare les indices de la question en cours
	//@return : booléen (vrai -> indices préparés ; faux -> trop peu de choix pour faire des indices)
	prepareClues: function(){
		var tabAvailable = new Array();
		var ok = false;
		
		//on crée le bouton d'indice
		this.createCluesBtn();
		
		//on désactive le bouton d'indice
		this.getDomCluesBtn().disabled = true;
		
		//on sélectionne tous les choix cliquables (hormis la bonne réponse, qu'on ajoutera par la suite)
		for (var i = 0 ; i < this.wrongAnswers.length ; i++) {
			tabAvailable.push(this.wrongAnswers[i]);
		}
		for (var i = this.index ; i < this.length ; i++) {
			tabAvailable.push(this.getSolutionKey(i));
		}
		if(tabAvailable.length >= this.options.nbCluesGiven - 1) {
			//on met la solution dans les indices
			this.clues.push(this.getCurrentSolutionKey());
			//puis on met d'autres possibilités au hasard
			tabAvailable.shuffle();
			for (var i = 0 ; i < this.options.nbCluesGiven - 1 ; i++) {
				this.clues.push(tabAvailable[i]);
			}
			
			//on lance le timer qui enclenchera l'affichage du bouton d'indice
			this.countdownClues.start();
			
			ok = true;
		}
		else {
			//todo : on supprime le bouton d'indices ?
		}
		return ok;
	},
	
	//met en surbrillance un nombre restreint de pays, parmi lesquels la bonne réponse...
	showClues: function() {
		//on désactive le bouton d'indice
		//this.getDomCluesBtn().disabled = true;
		//on détruit le bouton d'indice
		this.destroyCluesBtn();
		//on met en surbrillance les indices //TODO : à mettre dans quizzMap
		for (var i = 0 ; i < this.clues.length ; i++) {
			$(this.clues[i]).setAttribute('class', 'clue');
		}
	},
	
	removeOldClues: function() {
		//on arrête le compte à rebours gérant l'affichage des indices
		if(this.countdownClues) {
			this.countdownClues.stop();
		}
		
		//on retire les indices visuels
		for (var i = 0 ; i < this.clues.length ; i++) {
			if ($(this.clues[i]).getAttribute('class') == 'clue') { //TODO : trouver ue solution plus générique et mettre dans quizzMap
				$(this.clues[i]).setAttribute('class', 'base');
			}
		}
		//on réinitialise le tableau
		this.clues.empty();
	},
	
	endQuizz: function(){
		var msg = '';
		var nbErrors = this.wrongAnswers.length;
		
		//si le quizz est complet, on arrête le compte à rebours du quizz 
		
		if(this.isCompleted && ! this.isTraining()) {
			this.countdown.stop();
		}
		//sinon, le compte à rebours est terminé, on affiche la solution de la dernière question
		else{
			$(this.getCurrentSolutionKey()).setAttribute('class', 'correction');
		}
		
		//on supprime le bouton d'indices
		this.getDomCluesBtn().dispose();
		
		//on retire la possibilité de cliquer et on met le titre de chaque élément de la carte //TODO : à remettre dans quizzMap
		for (var i = 0 ; i < this.length ; i++) {
			$(this.getSolutionKey(i)).setAttribute('onclick', '');
			$(this.getSolutionKey(i)).setAttribute('title', this.getSolution(i));
		}
		
		//GESTION DU MESSAGE
		if(this.isCompleted) {
			msg = this.options.completedMsg;	
		}
		else{
			msg = this.options.countdownFinalMsg;
		}
		this.createEndGamePanel(msg);
	},

		
	showResults: function(){
		
		//on met en avant les erreurs effectuées
		for (var i = 0 ; i < this.wrongAnswers.length ; i++) {  //TODO : à mettre dans quizzMap
			$(this.wrongAnswers[i]).setAttribute('class', 'correction');
		}
				
		//on affiche les tips (info bulle)
		this.showTips();
		
		//on met un curseur de type aide pour chaque élément de la carte disposant d'un titre
		$$('.base, .correction, .correct, .notused').setStyle('cursor', 'help');

		//on note la position du panneau de commandes
		var p = $('indicatorPanel').getPosition(); //TODO : panneau à mettre sous forme de variable DOM
		//on efface les panneaux de jeu (pas la carte)
		this.destroyEndGamePanel();
		this.destroyQuestionPanel();
		//if(! this.isTraining()) {
			this.destroyIndicatorPanel();
		//}
		
		//on crée enfin le panneau de résultats
		this.createResultsPanel(p);
	},
	
	
	removeResults: function() {
		
		//on supprime l'éventuel panneau de résultats
		this.destroyResultsPanel();
		
		//on met remet un curseur normal pour chaque élément de la carte disposant d'un titre
		$$('.base, .correction, .correct, .notused').setStyle('cursor', 'auto');
		
		$$('.base, .correction, .correct, .notused').setStyle('title', '');
		
		//on désactive les tips
		this.hideTips();
	},
	
	//affiche une info bulle sur les éléments du quizz
	showTips: function() {
		if(this.tips) {
			$('.map_tip').setStyle('visibility', 'visible');
		}
		else {
			this.tips = new Tips($('.base, .correction, .correct, .notused'), { className: 'map_tip' });
		}
	},
	
	//cache les info bulles sur les éléments du quizz
	hideTips: function() {
		if(this.tips) {
			$('.map_tip').setStyle('visibility', 'hidden');
		}
	},

//ELEMENTS GRAPHIQUES

	//panneau d'indications (score, temps, combo)
	createIndicatorPanel: function(){
	
		var panel = Elements.from(

"<div id='indicatorPanel' class='quizzPanel'>" +
	"<table width='100%' >" +
		"<tr>"+
			"<td>Temps</td>" +
			"<td>Combo</td>" +
			"<td>Points</td>" +
		"</tr>" +
		"<tr>" +
			"<td><span id='countdown'></span></td>" +
			"<td>" +
				"<span id='combo'>" +
"<svg width='70' height='21' xmlns='http://www.w3.org/2000/svg'>" +
	"<desc>Combo</desc>" +
	"<defs>" +
		"<style type='text/css'>" +
		"</style>" +
	"</defs>" +
	"<g transform='translate(-0.49623481,-5.4041983)'>" +
		"<path " +
			"class='star starEmpty' " +
			"id='star1' " +
			"d='M 17.450831,20.63857 6.183341,16.756863 -3.4020285,23.838152 -3.1921512,11.922619 -12.8889,4.9946296 -1.4916985,1.5121325 2.1007508,-9.8508898 8.9347312,-0.08765816 20.851736,-0.18240279 13.678167,9.3341033 z' " +
			"transform='matrix(0.60916408,0.08615325,-0.08615325,0.60916408,8.7779931,11.80156)' />" +
		"<path " +
			"class='star starEmpty'" +
			"id='star2'" + 
			"d='M 17.450831,20.63857 6.183341,16.756863 -3.4020285,23.838152 -3.1921512,11.922619 -12.8889,4.9946296 -1.4916985,1.5121325 2.1007508,-9.8508898 8.9347312,-0.08765816 20.851736,-0.18240279 13.678167,9.3341033 z' " +
			"transform='matrix(0.60916408,0.08615325,-0.08615325,0.60916408,33.029307,11.623748)'/>" +
		"<path " +
			"class='star starEmpty' " +
			"id='star3' " +
			"d='M 17.450831,20.63857 6.183341,16.756863 -3.4020285,23.838152 -3.1921512,11.922619 -12.8889,4.9946296 -1.4916985,1.5121325 2.1007508,-9.8508898 8.9347312,-0.08765816 20.851736,-0.18240279 13.678167,9.3341033 z' " +
			"transform='matrix(0.60916408,0.08615325,-0.08615325,0.60916408,57.479515,11.22402)' />" +
	"</g>" +
"</svg>" +
				"</span>" +
			"</td>" +
			"<td><span id='score'>0</span></td>" +
		"</tr>" +
	"</table>" +
"</div>"	
		);

		$(document.body).adopt(panel);
		
		this.setDomIndicatorPanel($('indicatorPanel'));
		
		this.setDomCountdown($('countdown'));
		
		this.setDomScore($('score'));
		
		this.setDomCombo($('combo'));
		
		//positionnement (à gauche de la carte)
		var p = $('map').getPosition();
		var s = $('map').getSize();
		
		var myDrag = new Drag.Move(this.getDomIndicatorPanel(), {});
		this.getDomIndicatorPanel().setStyle('top', (s.y / 2 - 170) + 'px');
		this.getDomIndicatorPanel().setStyle('left', '10px');
		
	},
	
	destroyIndicatorPanel: function(){
		this.getDomIndicatorPanel().dispose();  //TODO : panneau à mettre sous forme de variable DOM
		this.setDomIndicatorPanel(null);
	},
	
	//création du Panneau de questions
	createQuestionPanel: function(){
	
		var panel = new Element("div", {'id': 'questionPanel', 'class': 'quizzPanel'});
		$(document.body).adopt(panel);
		this.setDomQuestionPanel($('questionPanel'));
		
		//positionnement (à gauche de la carte)
		var p = $('map').getPosition();
		var s = $('map').getSize();
		
		var myDrag = new Drag.Move($('questionPanel'), {});
		this.getDomQuestionPanel().setStyle('top', (s.y / 2 - 100) + 'px');
		this.getDomQuestionPanel().setStyle('left', '10px');
		
		//titre
		var header = new Element('div', {'id': 'questionHeader'});
		header.textContent = this.options.title;
		this.getDomQuestionPanel().adopt(header);
		
		//corps
		var body = new Element('div', {'id': 'questionBody'});
		this.getDomQuestionPanel().adopt(body);
		var context = new Element('div', {'id': 'questionContext'});
		body.adopt(context);
		var spot = new Element('div', {'id': 'questionSpot'});
		body.adopt(spot);
		var trainingBtn = new Element("button", {'id': 'startBtn0', 'class': 'quizzBtn', 'text': this.options.trainingLbl}); 
		trainingBtn.addEvent('click', function(event) {this.start(0)}.bind(this));
		spot.adopt(trainingBtn);
		var easyBtn = new Element("button", {'id': 'startBtn1', 'class': 'quizzBtn', 'text': this.options.difficulty1Lbl}); 
		easyBtn.addEvent('click', function(event) {this.start(1)}.bind(this));
		spot.adopt(easyBtn);
		var averageBtn = new Element("button", {'id': 'startBtn2', 'class': 'quizzBtn', 'text': this.options.difficulty2Lbl}); 
		averageBtn.addEvent('click', function(event) {this.start(2)}.bind(this));
		spot.adopt(averageBtn);
		var hardBtn = new Element("button", {'id': 'startBtn3', 'class': 'quizzBtn', 'text': this.options.difficulty3Lbl}); 
		hardBtn.addEvent('click', function(event) {this.start(3)}.bind(this));
		spot.adopt(hardBtn);
			
		
		//footer
		var footer = new Element('table', {'id': 'questionFooter'});
		this.getDomQuestionPanel().adopt(footer);
		var footerTr = new Element('tr', {});
		footer.adopt(footerTr);
		footerTr.adopt(new Element('td', {'id' : 'cluePanel'}));
		footerTr.adopt(new Element('td', {'id' : 'questionNb'}));	
	},
	
	destroyQuestionPanel: function(){
		this.domQuestionPanel.dispose();
		this.setDomQuestionPanel(null);	
	},
	

	createCluesBtn: function(){
		if(!this.getDomCluesBtn()) {
			var cluesBtn = new Element("button", {'id': 'cluesBtn', 'class': 'quizzBtn', 'disabled': 'disabled', 'text': this.options.countdownCluesFinalMsg}); 
			cluesBtn.addEvent('click', function(event) {this.showClues()}.bind(this));
			$('cluePanel').adopt(cluesBtn); 
			
			this.setDomCluesBtn($('cluesBtn'));
			
			//on prépare le compte à rebours de l'affichage des indices
			var self = this;
			this.countdownClues = new Countdown({
				durationInSeconds: self.options.nbSecondsClues,
				fctToDo: function () {
					self.enableCluesBtn();
				},
				gui: self.getDomCluesBtn(),
				txtPrefix : self.options.countdownCluesPrefix,
				txtSuffix : self.options.countdownCluesSuffix
			});
		}
	},
	
	destroyCluesBtn: function(){
		this.countdownClues.stop();
		this.getDomCluesBtn().dispose();
		this.setDomCluesBtn(null);	
	},
	
	enableCluesBtn: function(){
		if(this.getDomCluesBtn()) {
			this.getDomCluesBtn().textContent = this.options.countdownCluesFinalMsg; 
			this.getDomCluesBtn().disabled = false;
		}
	},
	
	//création du Panneau de fin de jeu (soit suite à la fin de temps, soit après la dernière réponse) ; laisse le temps au joueur de voir sa dernière action 
	createEndGamePanel: function(msg){
		var endPanel = new Element("div", {'id': 'endGamePanel', 'class': 'quizzPanel'});
		$(document.body).adopt(endPanel);
		this.domEndGamePanel = $('endGamePanel');
		
		//positionnement (en-dessous du panneau de questions)
		var p = $('map').getPosition();
		var s = $('map').getSize();
		
		var myDrag = new Drag.Move($('endGamePanel'), {});
		$('endGamePanel').setStyle('left', (p.x + Math.round(s.x / 2) - 125) + 'px');
		$('endGamePanel').setStyle('top', (p.y + Math.round(s.y / 2) - 10) + 'px');
		
		//affichage du message de fin de jeu
		this.domEndGamePanel.textContent = msg;
		
		//création d'un bouton, qui déclenchera la création du panneau de résultats
		var resultsBtn = new Element("button", {'id': 'resultsBtn', 'class': 'quizzBtn', 'text': this.options.okLbl, 'style': 'display:block;'}); 
		resultsBtn.addEvent('click', function(event) {this.showResults()}.bind(this));
		this.domEndGamePanel.adopt(resultsBtn);
	},
	
	destroyEndGamePanel: function(){
		this.domEndGamePanel.dispose();	
		this.domEndGamePanel = null;	
	},
	
	//création du Panneau de résultats ; permet également de voir le quizz corrigé
	createResultsPanel: function(position){	
		var msg = '';
		var nbErrors = this.wrongAnswers.length;
		
		var resultsPanel = new Element("div", {'id': 'resultsPanel', 'class': 'quizzPanel'});
		$(document.body).adopt(resultsPanel);
		this.setDomResultsPanel($('resultsPanel'));
		
		//positionnement
		var myDrag = new Drag.Move($('resultsPanel'), {});
		this.getDomResultsPanel().setStyle('left', position.x + 'px');
		this.getDomResultsPanel().setStyle('top', position.y + 'px');
		
		//CONTENU TEXTUEL
		this.domResultsPanel.adopt(new Element("div", {'id': 'resultsHeader'}));
		$('resultsHeader').textContent = this.options.resultTitle;
		
		//on affiche le score
		this.domResultsPanel.adopt(new Element("p", {'text': this.options.scoreMsg + this.getScore()}));
		//temps final et score final
		if(!this.isTraining()){
			this.domResultsPanel.adopt(new Element("p", {'text': this.options.remainingTimeMsg + Math.ceil(this.getRemainingTime() / 1000)}));
			this.setScore(this.getScore() + Math.ceil(this.getRemainingTime() / 1000));
			this.domResultsPanel.adopt(new Element("p", {'text': this.options.finalScoreTimeMsg + this.getScore()}));
		}
		
		//on prépare le message de résultats
		if(this.isCompleted && nbErrors == 0) {
			this.domResultsPanel.adopt(new Element("p", {'text': this.options.congratulationMsg}));
		}
		else {
			this.domResultsPanel.adopt(new Element("p", {'text': this.options.nbFaultsMsg + nbErrors + '. '}));
			if ( nbErrors > 0) {
				this.domResultsPanel.adopt(new Element("p", {'text': this.options.finalSolutionMsg}));
			}	
		}
		
		//on prépare le graphique
		var results = new HtmlTable({
		properties: {
			id: 'tableResults',
			summary: 'Résultats'
		},
		headers: [this.options.statsCorrects, this.options.statsFaults, this.options.statsRemaining],
		rows: [
			[this.index - this.wrongAnswers.length, this.wrongAnswers.length, this.length - this.index]
		]
		});
		
		this.domResultsPanel.adopt(results);
		new MilkChart.Pie("tableResults", {
				width : 250,
				height : 160,
				padding : 10,
				fontSize: 10,
				border : false
				/*font - (string: Defaults to "Verdana") Font to be used for labels
				fontColor - (string: Defaults to #000000) Color used for labels
				fontSize - (int: Defaults to 10) Font size in pt
				background - (string: Defaults to #ffffff) Background color of chart
				chartLineColor - (string: Defaults to #333333) Color of value lines
				chartLineWeight - (int: Defaults to 1) Line Wieght of value lines in px
				borderWeight - (int: Defaults to 1) Border width in px
				borderColor - (string: Defaults to #333333) Border color
				titleSize - (int: Defaults to 18) Size of title font in pt
				titleFont - (string: Defaults to "Verdana") Font used for title
				titleColor - (string: Defaults to #000000) Font color for title
				showRowNames - (bool: Defaults to true) Show the row labels on one of the axes
				showValues - (bool: Defaults to true) Show values on one of the axes
				showKey - (bool: Defaults to true) Shows the column labels
				useZero - (bool: Defaults to true) Always use 0 as the lowest value
				copy - (bool: Defaults to false) Whether or not to hide the table or not
				clean - (bool: Defaults to false) Creates a copy of the table, cleaned of spurious elements added */
			});

		//on met un bouton pour recommencer le quizz
		var restartBtn = new Element("button", {'id': 'resetBtn', 'class': 'quizzBtn', 'text': this.options.resetBtnLbl});
		restartBtn.addEvent('click', function(event) {this.reset()}.bind(this));
		this.domResultsPanel.adopt(restartBtn); 
	},

	destroyResultsPanel: function(){
		if(this.getDomResultsPanel()) {
			this.getDomResultsPanel().dispose();	
			this.setDomResultsPanel(null);
		}
	},	
	
	//création du Panneau de fin de jeu (soit suite à la fin de temps, soit après la dernière réponse) ; laisse le temps au joueur de voir sa dernière action 
	createZoomPanel: function(){
		this.scale = 4;
		var zoomPanel = new Element("div", {'id': 'zoomPanel', 'class': 'quizzPanel'});
		$(document.body).adopt(zoomPanel);
		this.domZoomPanel = $('zoomPanel');
		
		//positionnement (en-dessous du panneau de questions)
		var p = $('map').getPosition();
		var s = $('map').getSize();
		var myDrag = new Drag.Move($('zoomPanel'), {});
		$('zoomPanel').setStyle('left', '10px');
		$('zoomPanel').setStyle('top', '10px');
		
		//pour faire une viseur, on crée un svg qu'on affiche au-dessus
		var svgTarget = Elements.from(
'<svg height="208" width="250" stroke-opacity="0.8" style="z-index: 18; position: absolute;">' +
	'<g>' +
		'<line class="lineSVG" y2="104" x2="95" y1="104" x1="119" style="stroke: rgb(255, 0, 0); stroke-width: 2px;" />' +
		'<line class="lineSVG" y2="104" x2="121" y1="104" x1="129" style="stroke: rgb(255, 0, 0); stroke-width: 1px;" />' +
		'<line class="lineSVG" y2="104" x2="131" y1="104" x1="155" style="stroke: rgb(255, 0, 0); stroke-width: 2px;" />' +
		'<line class="lineSVG" y2="74" x2="125" y1="98" x1="125" style="stroke: rgb(255, 0, 0); stroke-width: 2px;" />' +
		'<line class="lineSVG" y2="100" x2="125" y1="108" x1="125" style="stroke: rgb(255, 0, 0); stroke-width: 1px;" />' +
		'<line class="lineSVG" y2="110" x2="125" y1="134" x1="125" style="stroke: rgb(255, 0, 0); stroke-width: 2px;" />' +
	'</g>' +
'</svg>'
		);
		this.domZoomPanel.adopt(svgTarget);

		//on crée le svg de la carte zoomée, en une tranche
		this.mapWidth  = $('mapsvg').getAttribute('width');
	    this.mapHeight = $('mapsvg').getAttribute('height');
		this.mapViewBox = $('mapsvg').getAttribute('viewBox');
		
		this.zoomMapWidth = parseInt($('questionPanel').getStyle('width').replace('px', '')); //on reprend la dimension du panneau de question ; cette dimension est fixée d'après le fichier de css
		this.zoomMapRatio = this.zoomMapWidth / this.mapWidth;
		this.zoomMapHeight = Math.round(this.zoomMapRatio * this.mapHeight);
		var paramViewBox = this.mapViewBox.split(' ');
		this.viewBoxHorizontalPan = parseFloat(paramViewBox[0]);
		this.viewBoxVerticalPan = parseFloat(paramViewBox[1]);
		this.zoomMapDimX = (paramViewBox[2] * this.zoomMapRatio);
		this.zoomMapDimY = (paramViewBox[3] * this.zoomMapRatio)
		var mapZoomViewBox = paramViewBox[0] + ' ' + paramViewBox[1] + ' ' + this.zoomMapDimX + ' ' + this.zoomMapDimY; 
		
		this.domMapSvgZoom = $('mapsvg').clone(true, true); 
		this.domMapSvgZoom.setAttribute('width', this.zoomMapWidth);
		this.domMapSvgZoom.setAttribute('height', this.zoomMapHeight);
		this.domMapSvgZoom.setAttribute('viewBox', mapZoomViewBox);	
		this.mapSvgZoomTransMatrix = [1,0,0,1,0,0];
		this.zoomMap(4);
		this.domZoomPanel.adopt(this.domMapSvgZoom);
		//$('mapsvg').getElement('g').setAttribute('onmousemove', 'displayZoom(evt)');
		$('mapsvg').addEvent('mousemove', function(event) { this.displayZoom(event);}.bind(this));
		
		//on déclenche le mouseover du zoom quand l'utilisateur survole le svg principal : le but est d'avoir les deux mêmes zones illuminées en même temps
		var key;
		for (var i = 0 ; i < this.length ; i++) {
			key = this.getSolutionKey(i);
			$('map').getElements('#' + key).addEvents({
				'mouseover': function(event) {this.zoomMouseOver(event)}.bind(this),
				'mouseleave': function(event){
					//on efface la classe zoomOver
					$('zoomPanel').getElement('#' + event.target.id).removeClass('zoomOver');
				}
			});
		}
	},
	
	zoomMouseOver: function(event){
		var elt = $('zoomPanel').getElement('#' + event.target.id);
		var cl = elt.getAttribute('class');
		//on ajoute la classe mouseover avant la classe courante ; pour cela on supprime la classe courante et on la réinjecte après
		elt.removeClass(cl);
		elt.addClass('zoomOver');
		elt.addClass(cl);
	},
	
	zoomMap: function(scale){
		this.scale = scale;
		for (var i=0; i < this.mapSvgZoomTransMatrix.length; i++){
			this.mapSvgZoomTransMatrix[i] *= scale;
		}
		this.mapSvgZoomTransMatrix[4] += (1 - scale) * this.zoomMapWidth / 2;
		this.mapSvgZoomTransMatrix[5] += (1 - scale) * this.zoomMapHeight / 2;
		var newMatrix = "matrix(" +  this.mapSvgZoomTransMatrix.join(' ') + ")";
		this.domMapSvgZoom.getElement('g').setAttribute('transform', newMatrix);
	},
	
	displayZoom: function(evt){	
		//fonction volontairement optimisée car exécutée sur une grande fréquence
		//coordonnées du curseur sur la carte
		if(! this.zoomSvgPnt) {
			this.zoomSvgPnt = $('mapsvg').createSVGPoint();
		}
		this.zoomSvgPnt.x = evt.event.clientX;
		this.zoomSvgPnt.y = evt.event.clientY;
		var iPNT = this.zoomSvgPnt.matrixTransform(evt.target.getScreenCTM().inverse());
		
		//on applique le viewBox
		this.domMapSvgZoom.setAttribute('viewBox', (iPNT.x - (this.zoomMapDimX / 2))  + ' ' + (iPNT.y - (this.zoomMapDimY / 2)) + ' ' + this.zoomMapDimX + ' ' + this.zoomMapDimY);
		
		//... et on applique le zoom
		this.mapSvgZoomTransMatrix[4] = iPNT.x * (1 - this.scale);  
		this.mapSvgZoomTransMatrix[5] = iPNT.y * (1 - this.scale);
		this.domMapSvgZoom.getElement('g').setAttribute('transform', "matrix(" +  this.mapSvgZoomTransMatrix.join(' ') + ")");
		
	},
	
	
	refreshScore: function(){
		this.getDomScore().textContent = this.score;
	},
	
	refreshCombo: function(){
		//on affiche les étoiles
		for (var i = 1 ; i < this.options.comboMax + 1 ; i++) {
			if(i <= this.getCombo()) {
				$("star" + i).setAttribute('class', 'star starFullLevel' + this.getLevel()); //la couleur des étoiles est différente en fonction du niveau
			}
			else {
				$("star" + i).setAttribute('class', 'star starEmpty');
			}
		}
		//this.options.domCombo.textContent = this.combo;
	},
	
	displayQuestionNb: function(content){
		$("questionNb").textContent = content;
	},
	
	displayQuestionContext: function(content){
		$("questionContext").textContent = content;
	},
	
	displayQuestionSpot: function(content){
		$("questionSpot").textContent = content;
	},
	
//IS
	isTraining: function(){
		return this.getLevel() == 0;
	},
		
//GETTERS
	
	getSolution: function(index) {
		return this.options.solutions[this.solutionsLayout[index]];
	},
	
	getCurrentSolution: function() {
		return this.getSolution(this.index);
	},
	
	getSolutionKey: function(index) {
		return this.options.solutionsKeys[this.solutionsLayout[index]];
	},
	
	getCurrentSolutionKey: function() {
		return this.getSolutionKey(this.index);
	},

	getLevel: function() {
		return this.level;
	},
	
	getScore: function() {
		return this.score;
	},
	
	getCombo: function() {
		return this.combo;
	},
	
	getDurationInSeconds: function() {
		return this.durationInSeconds;
	},
	
	getNbSecondsBonus: function() {
		return this.nbSecondsBonus;
	},
	
	//temps restant avant la fin du quizz (en millisecondes)
	getRemainingTime: function(){
		return this.countdown.getRemainingTime();
	},
	
	// Renvoie le panneau (élément DOM) affichant les indications de temps, score et combo  
	getDomIndicatorPanel: function() {
		return this.domIndicatorPanel;
	},
	
	// Renvoie l'élément DOM affichant les indications de temps  
	getDomCountdown: function() {
		return this.domCountdown;
	},
	
	// Renvoie l'élément DOM affichant les indications de score
	getDomScore: function() {
		return this.domScore;
	},
	
	// Renvoie l'élément DOM affichant les indications de combo  
	getDomCombo: function() {
		return this.domCombo;
	},
	
	// Renvoie le panneau (élément DOM) affichant les questions  
	getDomQuestionPanel: function() {
		return this.domQuestionPanel;
	},
	
	// Renvoie le bouton (élément DOM) permettant d'obtenir un indice  
	getDomCluesBtn: function() {
		return this.domCluesBtn;
	},
	
	// Renvoie le panneau (élément DOM) affichant les résultats  
	getDomResultsPanel: function() {
		return this.domResultsPanel;
	},
	
	
	//SETTERS
	
	/*setLevel : définit le niveau du quizz (entier de 1 à 3)
	/!\ : définir le niveau de difficulté affecte directement certains paramètres (durée du quizz et temps gagné en bonus)
	*/
	setLevel: function(level) {
		this.level = level;
		switch (level) {
			case 1:
				this.setDurationInSeconds(Math.max(this.length * 3, 15));
				this.setNbSecondsBonus(2);
				break;
			case 2:
				this.setDurationInSeconds(Math.max(this.length * 2, 15));
				this.setNbSecondsBonus(2);
				break;
			case 3:
				this.setDurationInSeconds(Math.max(this.length * 1, 15));
				this.setNbSecondsBonus(2);
				break;
		}
	},
	
	setScore: function(score) {
		this.score = score;
	},
	
	setDurationInSeconds: function(durationInSeconds) {
		this.durationInSeconds = durationInSeconds;
	},
	
	setNbSecondsBonus: function(nbSecondsBonus) {
		this.nbSecondsBonus = nbSecondsBonus;
	},

	
	setCombo: function(combo) {
		this.combo = combo;
	},
	
	setDomIndicatorPanel: function(dom) {
		this.domIndicatorPanel = dom;
	},
	
	setDomCountdown: function(domCountdown) {
		this.domCountdown = domCountdown;
	},
	
	setDomScore: function(domScore) {
		this.domScore = domScore;
	},
	
	setDomCombo: function(domCombo) {
		this.domCombo = domCombo;
	},
	
	setDomQuestionPanel: function(dom) {
		this.domQuestionPanel = dom;
	},
	
	setDomCluesBtn: function(dom) {
		this.domCluesBtn = dom;
	},
	
	setDomResultsPanel: function(dom) {
		this.domResultsPanel = dom;
	},
	
});

//COMPTE A REBOURS (géré en secondes)
//déclenche une action au bout d'un certain temps et affiche les secondes qui passe dans un élément DOM
var Countdown = new Class({
	Implements: [Options, Events],
	options: {
		durationInSeconds: 10,
		fctToDo: function () {alert("end countdown !");},
		txtPrefix: '',
		txtSuffix: ''
	},
	initialize: function (options){
		this.setOptions(options);
		this.timerId = null;
		this.toStop = false;
		this.remainingTime = this.durationInSeconds;
		//durationInSeconds, fctToDo, gui, txtPrefix, txtSuffix
	},
	start: function() {
		this.toStop = false;
		this.startTime = new Date();
		this.endTime = new Date();
		this.endTime.setSeconds(this.endTime.getSeconds() + this.options.durationInSeconds);
		this.run();
	},
	run: function() {
		if(this.toStop) {
			clearTimeout(this.timerId);
		}
		else {
			this.refreshRemainingTime();
			//on affiche le temps
			if (this.options.gui) { 
				this.options.gui.textContent = this.options.txtPrefix + Math.ceil(this.remainingTime / 1000) + this.options.txtSuffix;
			}
			//si le compte à rebours n'est pas fini, on relance le timer
			if (this.remainingTime > 0) {
				this.timerID = setTimeout(this.run.bind(this), 10);
			}
			else {
				//à la fin du compte à rebours, on exécute l'action finale
				this.options.fctToDo();
			}
		}
	},
	//arrête le compte à rebours ; note : l'arrêt effectif se fera au prochain déclenchement du processus
	stop: function() {
		this.refreshRemainingTime();
		this.toStop = true;
	},
	//ajoute du temps supplémentaire (en secondes)
	addTime: function(durationInSeconds) {
		this.endTime.setSeconds(this.endTime.getSeconds() + durationInSeconds);
		this.remainingTime += durationInSeconds * 1000;
	},
	//actualise le temps restant
	refreshRemainingTime: function() {
		var date = new Date();
		this.remainingTime = Math.max(this.endTime - date, 0);
	},
	//renvoie le temps restant en millisecondes
	getRemainingTime: function(){
		return this.remainingTime;
	}
});

