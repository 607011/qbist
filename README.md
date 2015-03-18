# qbist

**Algorithmische Kunstwerke mit JavaScript Web Workers, Chrome Native Client (NaCl) und WebGL-Shadern**

![Qbist-Beispielbild](https://github.com/ola-ct/qbist/blob/master/gallery/004.png)

Der Ex-[c't](http://www.ct.de/)-Kollege [Jörn Loviscach](http://www.j3l7h.de/), der mittlerweile als Mathe-Professor tätig ist, hat 1995 einen hübschen Algorithmus ausgetüftelt, der durch Farbraumtransformationen Grafiken berechnet, die an moderne Kunst à la Kandinsky, Macke oder Malewitsch erinnern. Die meisten damit generierten Bilder haben kubistische Züge, und deshalb hat er das Programm *Qbist* genannt.

Ausgehend von einem rechteckigen Bild beliebigen Ausmaßes mit einem Farbverlauf, bei dem der Rotanteil nach rechts von Schwarz bis zur Vollfarbe und der Grünanteil analog dazu nach unten wächst, wendet der Qbist-Algorithmus auf jedes Pixel eine Reihe von Farbraumtransformationen an. Zu Beginn einer Transformationssequenz lädt er sechs Register mit dem jeweiligen R- und G-Wert des Pixels, der B-Wert wächst proportional mit der Registernummer. Eine einzelne Transformation wählt den RGB-Wert von ein oder zwei Registern aus, verknüpft sie miteinander und schreibt sie in ein drittes Register. Es gibt acht verschiedene Verknüpfungen, etwa die Multiplikation, das zirkuläre Vertauschen der RGB-Komponenten oder Addition/Subtraktion. Nach 36 Transformationen bestimmt der RGB-Wert im Register 0 die Farbe des resultierenden Pixels.

Der Parametersatz für eine Transformationssequenz besteht demnach aus vier Arrays (Transformation, Zielregister, zwei Quellregister) mit je 36 Elementen. Zum Start werden die Arrays mit Zufallswerten befüllt.

## Literatur

  - Oliver Lau, Würze fürs Web, Verteiltes Rechnen mit JavaScript, [c't 9/12, S. 190](http://www.heise.de/artikel-archiv/ct/2012/9/190_kiosk)
  - Oliver Lau, Mit Pfeffer und Salz, Chrome-Plug-ins mit C/C++ entwickeln, [c't 10/12, S. 184](http://www.heise.de/artikel-archiv/ct/2012/10/184_kiosk)
  - liver Lau, Web auf Speed, Schnelle 2D-Grafiken im Browser mit WebGL, [c't 11/12, S. 182](http://www.heise.de/artikel-archiv/ct/2012/11/182_kiosk)
