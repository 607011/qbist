import sys, json

def readarray(f):
    result = []
    for i in xrange(36):
        word = f.read(2)
        result.append(ord(word[1]))
    return result

filename = sys.argv[1]
f = open(filename, 'rb');
d = {
    'transform': readarray(f),
    'source': readarray(f),
    'control': readarray(f),
    'dest': readarray(f)
}
print json.dumps(d)
f.close()